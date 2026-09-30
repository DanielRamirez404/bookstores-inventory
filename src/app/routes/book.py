from fastapi import Depends, HTTPException, status
from fastapi.routing import APIRouter
from sqlalchemy import delete, insert, select, update
from sqlalchemy.orm import Session

from app.config.db import get_db
from app.models.book import Book
from app.schemas.book import BookPayload

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
    stmt = (
        insert(Book)
        .values(**payload.model_dump())
        .returning(Book)
    )
    
    book = db.scalars(stmt).first()
    db.commit()
    
    return book

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
