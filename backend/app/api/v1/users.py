"""用户管理API - 管理员专用"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AdminUser
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserUpdateRole
from app.services.auth import auth_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=dict)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: AdminUser,  # 只有管理员可以访问
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    role: str | None = Query(None, pattern="^(admin|annotator|reviewer)$", description="Filter by role"),
    is_active: bool | None = Query(None, description="Filter by active status"),
) -> dict:
    """获取用户列表（管理员）
    
    Args:
        db: 数据库会话
        admin: 管理员用户（依赖注入验证）
        page: 页码
        limit: 每页数量
        role: 角色过滤
        is_active: 激活状态过滤
        
    Returns:
        dict: 分页用户列表
    """
    # 构建查询
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    # 计算总数
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt) or 0

    # 分页查询
    stmt = stmt.order_by(User.created_at.desc())
    stmt = stmt.limit(limit).offset((page - 1) * limit)
    result = await db.execute(stmt)
    users = result.scalars().all()

    return {
        "items": [UserResponse.model_validate(user) for user in users],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0,
    }


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: AdminUser,
) -> UserResponse:
    """创建新用户（管理员）
    
    Args:
        user_data: 用户信息
        db: 数据库会话
        admin: 管理员用户
        
    Returns:
        UserResponse: 创建的用户信息
        
    Raises:
        HTTPException: 400 - 用户名或邮箱已存在
    """
    # 检查用户名是否已存在
    stmt = select(User).where(User.username == user_data.username)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    # 检查邮箱是否已存在
    stmt = select(User).where(User.email == user_data.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists",
        )

    # 创建用户
    hashed_password = auth_service.get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return UserResponse.model_validate(new_user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: AdminUser,
) -> UserResponse:
    """获取用户详情（管理员）
    
    Args:
        user_id: 用户ID
        db: 数据库会话
        admin: 管理员用户
        
    Returns:
        UserResponse: 用户信息
        
    Raises:
        HTTPException: 404 - 用户不存在
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: AdminUser,
) -> UserResponse:
    """更新用户信息（管理员）
    
    Args:
        user_id: 用户ID
        user_data: 更新的用户信息
        db: 数据库会话
        admin: 管理员用户
        
    Returns:
        UserResponse: 更新后的用户信息
        
    Raises:
        HTTPException: 404 - 用户不存在
        HTTPException: 400 - 邮箱已被使用
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # 检查邮箱是否已被其他用户使用
    if user_data.email and user_data.email != user.email:
        stmt = select(User).where(User.email == user_data.email)
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use",
            )
        user.email = user_data.email

    # 更新字段
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    await db.commit()
    await db.refresh(user)

    return UserResponse.model_validate(user)


@router.put("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    role_data: UserUpdateRole,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: AdminUser,
) -> UserResponse:
    """更新用户角色（管理员）
    
    Args:
        user_id: 用户ID
        role_data: 新角色
        db: 数据库会话
        admin: 管理员用户
        
    Returns:
        UserResponse: 更新后的用户信息
        
    Raises:
        HTTPException: 404 - 用户不存在
        HTTPException: 400 - 不能修改自己的角色
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # 防止管理员修改自己的角色
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    user.role = role_data.role
    await db.commit()
    await db.refresh(user)

    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: AdminUser,
) -> None:
    """删除用户（管理员）
    
    Args:
        user_id: 用户ID
        db: 数据库会话
        admin: 管理员用户
        
    Raises:
        HTTPException: 404 - 用户不存在
        HTTPException: 400 - 不能删除自己
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # 防止管理员删除自己
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself",
        )

    await db.delete(user)
    await db.commit()

