from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.book import book

app = FastAPI()

origins = [
    "http://localhost:5173",  # frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            
    allow_credentials=True,           
    allow_methods=["*"],              
    allow_headers=["*"],              
)

app.include_router(book)
