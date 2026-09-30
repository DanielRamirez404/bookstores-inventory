from fastapi import FastAPI
from sqlalchemy import inspect

from app.config.db import engine

app = FastAPI()


@app.get("/")
async def root():
    return inspect(engine).get_table_names()
