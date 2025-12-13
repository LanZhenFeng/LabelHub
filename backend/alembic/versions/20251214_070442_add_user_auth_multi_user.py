"""add_user_auth_multi_user

Revision ID: 5da380f0b2b7
Revises: 997d87efd364
Create Date: 2025-12-14 07:04:42.827765

M4: Multi-user Authentication & Authorization
- Create users table with role-based access
- Add annotator_id, assigned_at, assigned_by to items
- Change annotation_events.user_id from String to Integer FK
- Create default admin user
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "5da380f0b2b7"
down_revision: Union[str, None] = "997d87efd364"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. 创建 user_role 枚举类型（仅 PostgreSQL）
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.execute(
            "CREATE TYPE user_role AS ENUM ('admin', 'annotator', 'reviewer')"
        )

    # 2. 创建 users 表
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("admin", "annotator", "reviewer", name="user_role")
            if conn.dialect.name == "postgresql"
            else sa.String(20),
            nullable=False,
            server_default="annotator",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    # 3. 修改 items 表 - 添加 annotator 相关字段
    with op.batch_alter_table("items", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "annotator_id",
                sa.Integer(),
                nullable=True,
                comment="Assigned annotator user ID",
            )
        )
        batch_op.add_column(
            sa.Column(
                "assigned_at",
                sa.DateTime(timezone=True),
                nullable=True,
                comment="Timestamp when item was assigned",
            )
        )
        batch_op.add_column(
            sa.Column(
                "assigned_by",
                sa.Integer(),
                nullable=True,
                comment="User ID who assigned this item",
            )
        )
        batch_op.create_index(batch_op.f("ix_items_annotator_id"), ["annotator_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_items_annotator_id_users",
            "users",
            ["annotator_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_items_assigned_by_users",
            "users",
            ["assigned_by"],
            ["id"],
            ondelete="SET NULL",
        )

    # 4. 修改 annotation_events 表 - user_id 从 String 改为 Integer FK
    # 首先需要删除旧的 user_id 列，创建新的
    with op.batch_alter_table("annotation_events", schema=None) as batch_op:
        batch_op.drop_column("user_id")
        batch_op.add_column(
            sa.Column(
                "user_id",
                sa.Integer(),
                nullable=True,
                comment="User who performed this action (M4: changed to FK)",
            )
        )
        batch_op.create_index(
            batch_op.f("ix_annotation_events_user_id"), ["user_id"], unique=False
        )
        batch_op.create_foreign_key(
            "fk_annotation_events_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # 5. 创建默认管理员用户
    # 密码: admin123 (bcrypt hash)
    # 生产环境请立即修改！
    # 注意：使用 example.com 域名以通过 EmailStr 验证
    op.execute(
        text(
            """
            INSERT INTO users (username, email, hashed_password, role, is_active, created_at, updated_at)
            VALUES ('admin', 'admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyWUI3YTb30y', 'admin', 1, datetime('now'), datetime('now'))
            """
        )
    )


def downgrade() -> None:
    # 1. 删除默认管理员用户
    op.execute(text("DELETE FROM users WHERE username = 'admin'"))

    # 2. 恢复 annotation_events.user_id 为 String
    with op.batch_alter_table("annotation_events", schema=None) as batch_op:
        batch_op.drop_constraint("fk_annotation_events_user_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_annotation_events_user_id"))
        batch_op.drop_column("user_id")
        batch_op.add_column(sa.Column("user_id", sa.String(length=100), nullable=True))

    # 3. 删除 items 表的 annotator 相关字段
    with op.batch_alter_table("items", schema=None) as batch_op:
        batch_op.drop_constraint("fk_items_assigned_by_users", type_="foreignkey")
        batch_op.drop_constraint("fk_items_annotator_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_items_annotator_id"))
        batch_op.drop_column("assigned_by")
        batch_op.drop_column("assigned_at")
        batch_op.drop_column("annotator_id")

    # 4. 删除 users 表
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    # 5. 删除 user_role 枚举类型（仅 PostgreSQL）
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.execute("DROP TYPE user_role")


