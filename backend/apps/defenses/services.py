"""Defense-scheduling conflict detection and open-slot suggestions.

Flags a proposed booking against already-confirmed (APPROVED) schedules on
the same date that share either a location or a voting member (the group's
adviser or an approved panelist) with an overlapping time window.
"""
import datetime

from .models import DefenseSchedule, ScheduleStatus


def _window(date, time, duration_minutes):
    start = datetime.datetime.combine(date, time)
    end = start + datetime.timedelta(minutes=duration_minutes)
    return start, end


def _voters(group):
    voters = set()
    if group.adviser_id:
        voters.add(group.adviser_id)
    voters.update(
        group.panel_assignments.filter(status="APPROVED").values_list("faculty_id", flat=True)
    )
    return voters


def _overlaps(existing_schedules, group, date, time, duration_minutes, location=""):
    """Check a candidate booking against an already-fetched list of schedules.

    Returns a list of {schedule_id, group_name, reason} conflicts, or [].
    """
    start, end = _window(date, time, duration_minutes)
    voters = _voters(group)

    conflicts = []
    for other in existing_schedules:
        if other.date != date:
            continue
        other_start, other_end = _window(other.date, other.time, other.duration_minutes)
        if not (start < other_end and other_start < end):
            continue  # no time overlap

        reasons = []
        if location and other.location and location.strip().lower() == other.location.strip().lower():
            reasons.append(f"location “{other.location}” is already booked at that time")
        shared_voters = voters & _voters(other.group)
        if shared_voters:
            reasons.append("shares an adviser/panelist with another confirmed defense at that time")

        if reasons:
            conflicts.append({
                "schedule_id": other.id,
                "group_name": other.group.name,
                "reason": "; ".join(reasons),
            })
    return conflicts


def find_conflicts(group, date, time, duration_minutes, location="", exclude_id=None):
    """Single-slot check — fetches just that day's confirmed schedules."""
    candidates = DefenseSchedule.objects.filter(
        date=date, status=ScheduleStatus.APPROVED
    ).select_related("group").prefetch_related("group__panel_assignments")
    if exclude_id:
        candidates = candidates.exclude(pk=exclude_id)
    return _overlaps(candidates, group, date, time, duration_minutes, location)


def suggest_slots(
    group, duration_minutes, location="",
    days_ahead=21, start_hour=8, end_hour=17, step_minutes=30, max_results=8,
):
    """Scan weekday business-hours slots over the next `days_ahead` days and
    return the first `max_results` that don't conflict with any confirmed
    defense — fetches confirmed schedules for the whole window once."""
    today = datetime.date.today()
    end_date = today + datetime.timedelta(days=days_ahead)
    existing = list(
        DefenseSchedule.objects.filter(
            date__range=(today, end_date), status=ScheduleStatus.APPROVED
        ).select_related("group").prefetch_related("group__panel_assignments")
    )

    slots = []
    day = today
    while day <= end_date and len(slots) < max_results:
        if day.weekday() < 5:  # Monday-Friday only
            minute_of_day = start_hour * 60
            while minute_of_day + duration_minutes <= end_hour * 60 and len(slots) < max_results:
                time = datetime.time(minute_of_day // 60, minute_of_day % 60)
                if not _overlaps(existing, group, day, time, duration_minutes, location):
                    slots.append({"date": day.isoformat(), "time": time.strftime("%H:%M")})
                minute_of_day += step_minutes
        day += datetime.timedelta(days=1)
    return slots
