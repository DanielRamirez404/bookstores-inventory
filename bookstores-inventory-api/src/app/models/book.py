from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.db import Base, engine, meta


class Book(Base):
    __tablename__: str = "books"

    id: Mapped[int] = mapped_column(primary_key=True)

    isbn: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    author: Mapped[str] = mapped_column(String(255)) # 255 por si hay muuuuuchos autores en un solo libro
    category: Mapped[str] = mapped_column(String(50))
    supplier_country: Mapped[str] = mapped_column(String(3)) # no sé si todos son de dos o hay de tres

    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    selling_price_local: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    stock_quantity: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )

meta.create_all(engine)
