"""Add bbox and polygon annotations tables

Revision ID: 20251214_000001
Revises: 20251213_000001
Create Date: 2025-12-14 00:00:01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20251214_000001'
down_revision: Union[str, None] = '20251213_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create bbox_annotations table
    op.create_table(
        'bbox_annotations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('label_id', sa.Integer(), nullable=False),
        sa.Column('x', sa.Float(), nullable=False),
        sa.Column('y', sa.Float(), nullable=False),
        sa.Column('width', sa.Float(), nullable=False),
        sa.Column('height', sa.Float(), nullable=False),
        sa.Column('attributes', sa.JSON(), nullable=True, comment='Additional attributes (occluded, truncated, etc.)'),
        sa.Column('user_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['label_id'], ['labels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bbox_annotations_item_id'), 'bbox_annotations', ['item_id'], unique=False)
    op.create_index(op.f('ix_bbox_annotations_label_id'), 'bbox_annotations', ['label_id'], unique=False)

    # Create polygon_annotations table
    op.create_table(
        'polygon_annotations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('label_id', sa.Integer(), nullable=False),
        sa.Column('points', sa.JSON(), nullable=False),
        sa.Column('attributes', sa.JSON(), nullable=True, comment='Additional attributes (occluded, crowd, etc.)'),
        sa.Column('user_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['label_id'], ['labels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_polygon_annotations_item_id'), 'polygon_annotations', ['item_id'], unique=False)
    op.create_index(op.f('ix_polygon_annotations_label_id'), 'polygon_annotations', ['label_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_polygon_annotations_label_id'), table_name='polygon_annotations')
    op.drop_index(op.f('ix_polygon_annotations_item_id'), table_name='polygon_annotations')
    op.drop_table('polygon_annotations')
    op.drop_index(op.f('ix_bbox_annotations_label_id'), table_name='bbox_annotations')
    op.drop_index(op.f('ix_bbox_annotations_item_id'), table_name='bbox_annotations')
    op.drop_table('bbox_annotations')

