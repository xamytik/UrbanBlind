"""osm_bigint_nodes

Revision ID: 8072ad9a9645
Revises: af739ff5cace
Create Date: 2026-03-30 15:47:58.630246

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8072ad9a9645'
down_revision: Union[str, Sequence[str], None] = 'af739ff5cace'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Upgrade to BigInteger for OSMNX
    op.alter_column('edges', 'start_node_id',
               existing_type=sa.INTEGER(),
               type_=sa.BigInteger(),
               existing_nullable=False)
    op.alter_column('edges', 'end_node_id',
               existing_type=sa.INTEGER(),
               type_=sa.BigInteger(),
               existing_nullable=False)
    op.alter_column('nodes', 'id',
               existing_type=sa.INTEGER(),
               type_=sa.BigInteger(),
               existing_nullable=False,
               autoincrement=False)


def downgrade() -> None:
    # Downgrade schema
    op.alter_column('nodes', 'id',
               existing_type=sa.BigInteger(),
               type_=sa.INTEGER(),
               existing_nullable=False,
               autoincrement=False)
    op.alter_column('edges', 'end_node_id',
               existing_type=sa.BigInteger(),
               type_=sa.INTEGER(),
               existing_nullable=False)
    op.alter_column('edges', 'start_node_id',
               existing_type=sa.BigInteger(),
               type_=sa.INTEGER(),
               existing_nullable=False)
