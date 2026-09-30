from fastapi import FastAPI

from app.routes.book import book

app = FastAPI()

app.include_router(book)
