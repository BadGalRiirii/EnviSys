"""Send reminders for milestones due within the next N days (default 3).

Run daily — e.g. a cron entry, a Render Cron Job, or manually:
    python manage.py send_deadline_reminders --days 3
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.groups.models import Milestone
from apps.notifications.services import notify_group


class Command(BaseCommand):
    help = "Notify groups about milestones due soon or overdue."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=3)

    def handle(self, *args, **options):
        today = timezone.localdate()
        horizon = today + timedelta(days=options["days"])
        due_soon = Milestone.objects.filter(
            is_completed=False, due_date__lte=horizon
        ).select_related("group")

        count = 0
        for m in due_soon:
            if m.due_date < today:
                title, msg = "Milestone overdue", f"“{m.title}” was due on {m.due_date}."
            else:
                title, msg = "Deadline approaching", f"“{m.title}” is due on {m.due_date}."
            notify_group(m.group, title, msg, include_adviser=True)
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Sent reminders for {count} milestone(s)."))
