"""Parser Template API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.parser_template import ParserTemplate
from app.schemas.parser_template import (
    ParserTemplateCreate,
    ParserTemplateResponse,
    ParserTemplateUpdate,
    ParseTestRequest,
    ParseTestResponse,
)
from app.services.parser import parse_json_data, parse_jsonl_stream

router = APIRouter()


@router.get("/parser-templates", response_model=list[ParserTemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
):
    """List all parser templates."""
    query = select(ParserTemplate).order_by(
        ParserTemplate.is_builtin.desc(),
        ParserTemplate.created_at.desc()
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/parser-templates/{template_id}", response_model=ParserTemplateResponse)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a parser template by ID."""
    query = select(ParserTemplate).where(ParserTemplate.id == template_id)
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template


@router.post(
    "/parser-templates",
    response_model=ParserTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    template_in: ParserTemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new parser template."""
    template = ParserTemplate(
        name=template_in.name,
        description=template_in.description,
        input_type=template_in.input_type,
        input_encoding=template_in.input_encoding,
        record_path=template_in.record_path,
        mapping=template_in.mapping,
        validation=template_in.validation,
        is_builtin=False,  # User templates are never builtin
    )
    
    db.add(template)
    await db.commit()
    await db.refresh(template)
    
    return template


@router.put("/parser-templates/{template_id}", response_model=ParserTemplateResponse)
async def update_template(
    template_id: int,
    template_in: ParserTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a parser template."""
    query = select(ParserTemplate).where(ParserTemplate.id == template_id)
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template.is_builtin:
        raise HTTPException(
            status_code=400,
            detail="Cannot modify builtin templates"
        )
    
    # Update fields
    if template_in.name is not None:
        template.name = template_in.name
    if template_in.description is not None:
        template.description = template_in.description
    if template_in.input_type is not None:
        template.input_type = template_in.input_type
    if template_in.input_encoding is not None:
        template.input_encoding = template_in.input_encoding
    if template_in.record_path is not None:
        template.record_path = template_in.record_path
    if template_in.mapping is not None:
        template.mapping = template_in.mapping
    if template_in.validation is not None:
        template.validation = template_in.validation
    
    await db.commit()
    await db.refresh(template)
    
    return template


@router.delete("/parser-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a parser template."""
    query = select(ParserTemplate).where(ParserTemplate.id == template_id)
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template.is_builtin:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete builtin templates"
        )
    
    await db.delete(template)
    await db.commit()


@router.post("/parser-templates/test", response_model=ParseTestResponse)
async def test_template(
    test_request: ParseTestRequest,
    db: AsyncSession = Depends(get_db),
):
    """Test a parser template with sample data."""
    # Get template config
    if test_request.template_id is not None:
        query = select(ParserTemplate).where(ParserTemplate.id == test_request.template_id)
        result = await db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        template_config = {
            "input_type": template.input_type,
            "input_encoding": template.input_encoding,
            "record_path": template.record_path,
            "mapping": template.mapping,
            "validation": template.validation,
        }
    elif test_request.template is not None:
        template_config = {
            "input_type": test_request.template.input_type,
            "input_encoding": test_request.template.input_encoding,
            "record_path": test_request.template.record_path,
            "mapping": test_request.template.mapping,
            "validation": test_request.template.validation,
        }
    else:
        raise HTTPException(
            status_code=400,
            detail="Either template_id or template must be provided"
        )
    
    # Parse data
    errors = []
    predictions = []
    
    try:
        if template_config["input_type"] == "jsonl":
            results = parse_jsonl_stream(
                test_request.sample_data.encode(template_config["input_encoding"]),
                template_config["mapping"],
                max_records=test_request.max_records,
            )
        else:  # json
            results = parse_json_data(
                test_request.sample_data,
                template_config["mapping"],
                record_path=template_config["record_path"],
                max_records=test_request.max_records,
            )
        
        predictions = results["predictions"]
        errors = results["errors"]
        
    except Exception as e:
        errors.append({"error": f"Parse failed: {str(e)}"})
    
    return ParseTestResponse(
        success=len(errors) == 0 and len(predictions) > 0,
        records_parsed=len(predictions),
        predictions=predictions,
        errors=errors,
    )

