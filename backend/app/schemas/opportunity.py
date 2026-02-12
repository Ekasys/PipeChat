"""Opportunity schemas"""
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, timezone
from decimal import Decimal


class OpportunityCreate(BaseModel):
    name: str
    agency: Optional[str] = None
    sub_agency: Optional[str] = None
    stage: Optional[str] = "qualification"
    status: Optional[str] = "active"
    value: Optional[Decimal] = None
    pwin: Optional[Decimal] = None
    ptw: Optional[Decimal] = None
    due_date: Optional[datetime] = None
    rfp_submission_date: Optional[datetime] = None
    award_date: Optional[datetime] = None
    naics_code: Optional[str] = None
    contract_vehicle: Optional[str] = None
    opportunity_type: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    history_notes: Optional[str] = None
    next_task_comments: Optional[str] = None
    next_task_due: Optional[datetime] = None
    capture_manager: Optional[str] = None
    agency_pocs: Optional[str] = None
    business_sectors: Optional[str] = None
    role: Optional[str] = None
    number_of_years: Optional[int] = None
    requirements: Optional[str] = None
    account_id: Optional[str] = None
    owner_id: Optional[str] = None
    bd_status: Optional[str] = None

    @field_validator('due_date', mode='before')
    @classmethod
    def convert_timezone_aware_to_naive(cls, v):
        """Convert timezone-aware datetime to naive (UTC) for database compatibility"""
        if v is None:
            return v
        
        # If it's already a datetime object
        if isinstance(v, datetime):
            if v.tzinfo is not None:
                # Convert to UTC and remove timezone
                return v.astimezone(timezone.utc).replace(tzinfo=None)
            return v
        
        # If it's a string, Pydantic will parse it, but we need to handle it after parsing
        # This validator runs before parsing, so we return as-is and handle in 'after' mode
        return v
    
    @field_validator('due_date', mode='after')
    @classmethod
    def ensure_naive_datetime(cls, v):
        """Ensure datetime is naive after Pydantic parsing"""
        if v is None:
            return v
        if isinstance(v, datetime) and v.tzinfo is not None:
            # Convert to UTC and remove timezone
            return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v

    @field_validator('rfp_submission_date', 'award_date', 'next_task_due', mode='before')
    @classmethod
    def convert_additional_dates_before(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace("Z", "+00:00"))
            except ValueError:
                return v
        return v

    @field_validator('rfp_submission_date', 'award_date', 'next_task_due', mode='after')
    @classmethod
    def convert_additional_dates_after(cls, v):
        if v is None:
            return v
        if isinstance(v, datetime) and v.tzinfo is not None:
            return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v


class OpportunityUpdate(BaseModel):
    name: Optional[str] = None
    agency: Optional[str] = None
    sub_agency: Optional[str] = None
    stage: Optional[str] = None
    status: Optional[str] = None
    value: Optional[Decimal] = None
    pwin: Optional[Decimal] = None
    ptw: Optional[Decimal] = None
    due_date: Optional[datetime] = None
    rfp_submission_date: Optional[datetime] = None
    award_date: Optional[datetime] = None
    naics_code: Optional[str] = None
    contract_vehicle: Optional[str] = None
    opportunity_type: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    history_notes: Optional[str] = None
    next_task_comments: Optional[str] = None
    next_task_due: Optional[datetime] = None
    capture_manager: Optional[str] = None
    agency_pocs: Optional[str] = None
    business_sectors: Optional[str] = None
    role: Optional[str] = None
    number_of_years: Optional[int] = None
    requirements: Optional[str] = None
    account_id: Optional[str] = None
    owner_id: Optional[str] = None
    bd_status: Optional[str] = None

    @field_validator('due_date', 'rfp_submission_date', 'award_date', 'next_task_due', mode='before')
    @classmethod
    def convert_update_dates_before(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace("Z", "+00:00"))
            except ValueError:
                return v
        return v

    @field_validator('due_date', 'rfp_submission_date', 'award_date', 'next_task_due', mode='after')
    @classmethod
    def convert_update_dates_after(cls, v):
        if v is None:
            return v
        if isinstance(v, datetime) and v.tzinfo is not None:
            return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v

