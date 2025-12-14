"""API依赖注入 - 认证和权限控制"""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.services.auth import auth_service

# OAuth2 token获取
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """获取当前登录用户
    
    Args:
        token: JWT access token
        db: 数据库会话
        
    Returns:
        User: 当前用户对象
        
    Raises:
        HTTPException: 401 - token无效或用户不存在
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = auth_service.verify_token(token)
        user_id: int | None = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # 从数据库查询用户
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """获取当前活跃用户（已激活且未禁用）
    
    Args:
        current_user: 当前用户
        
    Returns:
        User: 活跃用户对象
        
    Raises:
        HTTPException: 400 - 用户已被禁用
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return current_user


def require_role(allowed_roles: list[str]):
    """角色权限检查装饰器工厂
    
    Args:
        allowed_roles: 允许的角色列表，如 ['admin'] 或 ['admin', 'reviewer']
        
    Returns:
        依赖函数，用于检查用户角色
        
    Example:
        @router.get("/admin-only", dependencies=[Depends(require_role(["admin"]))])
        或
        admin_user: User = Depends(require_role(["admin"]))
    """

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        """检查用户角色是否在允许列表中
        
        Args:
            current_user: 当前用户
            
        Returns:
            User: 通过检查的用户
            
        Raises:
            HTTPException: 403 - 权限不足
        """
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required roles: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker


# 常用的依赖别名
CurrentUser = Annotated[User, Depends(get_current_active_user)]
AdminUser = Annotated[User, Depends(require_role(["admin"]))]

