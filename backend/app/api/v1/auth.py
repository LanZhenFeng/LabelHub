"""认证API端点 - 登录、注册、刷新token等"""
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import (
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    RegisterRequest,
    RegisterResponse,
    UpdatePasswordRequest,
    UserResponse,
)
from app.services.auth import auth_service

router = APIRouter(prefix="/auth", tags=["authentication"])
settings = get_settings()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RegisterResponse:
    """用户注册
    
    Args:
        user_data: 注册信息（用户名、邮箱、密码）
        db: 数据库会话
        
    Returns:
        RegisterResponse: 注册成功，返回用户信息和tokens
        
    Raises:
        HTTPException: 400 - 用户名或邮箱已存在
    """
    # 检查用户名是否已存在
    stmt = select(User).where(User.username == user_data.username)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # 检查邮箱是否已存在
    stmt = select(User).where(User.email == user_data.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # 创建新用户
    hashed_password = auth_service.get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role="annotator",  # 新注册用户默认为标注员
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # 生成tokens
    access_token = auth_service.create_access_token(
        data={"user_id": new_user.id, "username": new_user.username, "role": new_user.role}
    )
    refresh_token = auth_service.create_refresh_token(data={"user_id": new_user.id})

    return RegisterResponse(
        user=UserResponse.model_validate(new_user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    """用户登录（支持OAuth2 Password Flow）
    
    Args:
        form_data: OAuth2表单（username, password）
        db: 数据库会话
        
    Returns:
        LoginResponse: 登录成功，返回用户信息和tokens
        
    Raises:
        HTTPException: 401 - 用户名或密码错误
    """
    # 查询用户（支持用户名或邮箱登录）
    stmt = select(User).where(
        (User.username == form_data.username) | (User.email == form_data.username)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # 验证用户和密码
    if not user or not auth_service.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 检查用户是否已激活
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is inactive",
        )

    # 生成tokens
    access_token = auth_service.create_access_token(
        data={"user_id": user.id, "username": user.username, "role": user.role}
    )
    refresh_token = auth_service.create_refresh_token(data={"user_id": user.id})

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RefreshTokenResponse:
    """刷新访问令牌
    
    Args:
        request: 刷新令牌请求
        db: 数据库会话
        
    Returns:
        RefreshTokenResponse: 新的访问令牌
        
    Raises:
        HTTPException: 401 - 刷新令牌无效或过期
    """
    try:
        payload = auth_service.verify_token(request.refresh_token)
        user_id: int | None = payload.get("user_id")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # 验证用户是否存在且激活
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # 生成新的访问令牌
    access_token = auth_service.create_access_token(
        data={"user_id": user.id, "username": user.username, "role": user.role}
    )

    return RefreshTokenResponse(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: CurrentUser,
) -> UserResponse:
    """获取当前登录用户信息
    
    Args:
        current_user: 当前用户（通过依赖注入）
        
    Returns:
        UserResponse: 用户信息
    """
    return UserResponse.model_validate(current_user)


@router.put("/me/password", response_model=dict)
async def update_password(
    request: UpdatePasswordRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """修改当前用户密码
    
    Args:
        request: 修改密码请求（旧密码、新密码）
        current_user: 当前用户
        db: 数据库会话
        
    Returns:
        dict: 成功消息
        
    Raises:
        HTTPException: 400 - 旧密码错误
    """
    # 验证旧密码
    if not auth_service.verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password",
        )

    # 更新密码
    current_user.hashed_password = auth_service.get_password_hash(request.new_password)
    await db.commit()

    return {"message": "Password updated successfully"}


@router.post("/logout", response_model=dict)
async def logout(current_user: CurrentUser) -> dict:
    """用户登出（客户端需删除token）
    
    Args:
        current_user: 当前用户
        
    Returns:
        dict: 成功消息
        
    Note:
        由于使用JWT，服务端无状态，实际登出由客户端删除token实现
    """
    return {"message": "Logout successful. Please delete tokens on client side."}

