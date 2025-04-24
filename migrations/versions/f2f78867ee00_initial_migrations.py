"""initial migrations

Revision ID: f2f78867ee00
Revises: 
Create Date: 2025-04-24 14:33:47.758827

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2f78867ee00'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('card', schema=None) as batch_op:
        batch_op.add_column(sa.Column('position', sa.Integer(), nullable=True))

    with op.batch_alter_table('list', schema=None) as batch_op:
        batch_op.drop_column('color_id')

    with op.batch_alter_table('lobbies', schema=None) as batch_op:
        batch_op.create_foreign_key('fk_lobbies_archived_by', 'users', ['archived_by'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('lobbies', schema=None) as batch_op:
        batch_op.drop_constraint('fk_lobbies_archived_by', type_='foreignkey')

    with op.batch_alter_table('list', schema=None) as batch_op:
        batch_op.add_column(sa.Column('color_id', sa.TEXT(), server_default=sa.text("'default'"), nullable=True))

 

    # ### end Alembic commands ###
