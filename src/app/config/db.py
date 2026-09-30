import os
from pathlib import Path
from typing import ClassVar

from dotenv import load_dotenv
from sqlalchemy import MetaData, create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase

env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
_ = load_dotenv(env_path)

url = URL.create(
    drivername="postgresql+psycopg",
    username=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
    host=os.environ["HOST"],
    port=int(os.environ["POSTGRES_PORT"]),
    database=os.environ["POSTGRES_DB"],
)

engine = create_engine(url)

meta = MetaData()

class Base(DeclarativeBase):
    metadata: ClassVar[MetaData] = meta

conn = engine.connect()
