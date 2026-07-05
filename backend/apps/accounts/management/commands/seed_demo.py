"""Seed demo accounts for local testing.

Usage: python manage.py seed_demo
Creates: 1 admin (chairperson), 2 verified faculty, 3 students — all with
password 'envisys123' and pre-verified emails.
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import Role, User


DEMO_USERS = [
    dict(email="chair@ustp.edu.ph", username="chairperson", first_name="Dept",
         last_name="Chairperson", role=Role.ADMIN),
    dict(email="adviser1@ustp.edu.ph", username="adviser1", first_name="Jomar",
         last_name="Llevado", role=Role.FACULTY, specialization="Environmental Informatics",
         is_verified_faculty=True),
    dict(email="adviser2@ustp.edu.ph", username="adviser2", first_name="Esther",
         last_name="Chio", role=Role.FACULTY, specialization="Water Quality, Climate Adaptation",
         is_verified_faculty=True),
    dict(email="student1@ustp.edu.ph", username="student1", first_name="Rehana",
         last_name="Nicole", role=Role.STUDENT, student_id="2022-0001"),
    dict(email="student2@ustp.edu.ph", username="student2", first_name="Rehana",
         last_name="Ruilan", role=Role.STUDENT, student_id="2022-0002"),
    dict(email="student3@ustp.edu.ph", username="student3", first_name="Jay",
         last_name="Satore", role=Role.STUDENT, student_id="2022-0003"),
]


class Command(BaseCommand):
    help = "Seed demo users for local development."

    def handle(self, *args, **options):
        for data in DEMO_USERS:
            user, created = User.objects.get_or_create(email=data["email"], defaults=data)
            if created:
                user.set_password("envisys123")
                user.is_email_verified = True
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Created {user.email}"))
            else:
                self.stdout.write(f"Exists: {user.email}")
        self.stdout.write(self.style.SUCCESS("Done. Password for all demo users: envisys123"))
