import os

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.routing import APIRouter
from sqlalchemy import Numeric, cast, delete, func, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config.db import get_db
from app.config.path import env_path
from app.models.book import Book
from app.schemas.book import BookPayload
from app.utils.countries import country_to_currency_code, default_rates

_ = load_dotenv(env_path)

book = APIRouter(prefix='/books')

@book.get("/", status_code=status.HTTP_200_OK)
def get_books(
    threshold: int | None = None,
    category: str | None = None,
    limit: int = 5,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    stmt = select(Book)
    
    if threshold is not None:
        stmt = stmt.where(Book.stock_quantity <= threshold)
    if category is not None:
        stmt = stmt.where(Book.category == category)
        
    stmt = stmt.offset(offset).limit(limit)
    
    books = db.scalars(stmt).all()
    
    return books

@book.get("/{id}", status_code=status.HTTP_200_OK)
def get_book(id: int, db: Session = Depends(get_db)):
    query = select(Book).where(Book.id == id)
    book = db.scalars(query).first()
    
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found"
        )
        
    return book

@book.post("/", status_code=status.HTTP_201_CREATED)
def create_book(payload: BookPayload, db: Session = Depends(get_db)):
    stmt = insert(Book).values(**payload.model_dump()).returning(Book)
    
    try:
        book = db.scalars(stmt).first()
        db.commit()
        return book
    except IntegrityError:  # esto se lanza si no cumple con la constraint UNIQUE en ISBN
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A book with ISBN '{payload.isbn}' already exists."
        )

@book.put("/{id}")
def update_book(id: int, payload: BookPayload, db: Session = Depends(get_db)):
    stmt = (
        update(Book)
        .where(Book.id == id)
        .values(**payload.model_dump())
        .returning(Book)
    )
    
    book = db.scalars(stmt).first()
    db.commit()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found"
        )

    return book

@book.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(id: int, db: Session = Depends(get_db)):
    stmt = delete(Book).where(Book.id == id).returning(Book.id)
    deleted_id = db.execute(stmt).scalar_one_or_none()

    if deleted_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found"
        )

    db.commit()

    return deleted_id

@book.get("/{id}/calculate-price", status_code=status.HTTP_200_OK)
async def get_price(
    id: int,
    db: Session = Depends(get_db)
):
    api_url = f"https://v6.exchangerate-api.com/v6/{os.environ['EXCHANGE_RATE_API_KEY']}/latest/USD"

    async with httpx.AsyncClient() as client:
        success: bool = True
        try:
            response = await client.get(api_url)
            _ = response.raise_for_status()
            data = response.json()
        except httpx.HTTPError:
            success = False

    rates = data.get("conversion_rates", {}) if success else default_rates

    supplier_country = db.scalar(select(Book.supplier_country).where(Book.id == id))

    if supplier_country is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    if supplier_country not in country_to_currency_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Country '{supplier_country}' is not mapped to a currency",
        )

    currency = country_to_currency_code[supplier_country]

    if currency not in rates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rate for currency '{currency}' missing",
        )

    rate = rates[currency]
    calculated_price_mult = round(1.40 * rate, 2) # 40% de ganancia!!!

    stmt = (
        update(Book)
        .where(Book.id == id)
        .values(selling_price_local=func.round(
            cast(Book.cost_usd * calculated_price_mult, Numeric), 
            2
        ))
        .returning(Book)
    )

    updated_book = db.scalars(stmt).one_or_none()

    if updated_book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    db.commit()

    return {
        "book_id": updated_book.id,
        "cost_usd": updated_book.cost_usd,
        "exchange_rate": rate,
        "cost_local": round(float(updated_book.cost_usd) * rate, 2),
        "margin_percentage": 40,
        "selling_price_local": updated_book.selling_price_local,
        "currency": currency,
        "calculation_timestamp": updated_book.updated_at
    }
