from fastapi import APIRouter, Query
from ..services.analytics import (
    get_regional_comparison,
    get_trends,
    get_data_quality,
    get_top_categories,
    get_correlation_pairs,
)

router = APIRouter()


@router.get("/regions")
def regional_comparison(
    year: int = Query(2024, description="Year to compare"),
    category: str | None = Query(None, description="Optional category filter"),
):
    return get_regional_comparison(year, category)


@router.get("/trends")
def trends(
    region: str = Query(..., description="Region name"),
    category: str = Query(..., description="Category name"),
):
    return get_trends(region, category)


@router.get("/categories/top")
def top_categories(
    year: int = Query(2024, description="Year"),
    top_n: int = Query(10, description="Number of top categories"),
):
    return get_top_categories(year, top_n)


@router.get("/correlations")
def correlations(
    year: int = Query(2024, description="Year"),
    top_n: int = Query(10, description="Number of top pairs"),
):
    return get_correlation_pairs(year, top_n)


@router.get("/data-quality")
def data_quality():
    return get_data_quality()
