from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .models import DefenseResult, DefenseSchedule, Evaluation, Verdict

VERDICT_SEVERITY = [Verdict.FAILED, Verdict.REDEFENSE, Verdict.PASSED_WITH_REVISIONS, Verdict.PASSED]


class EvaluationSerializer(serializers.ModelSerializer):
    evaluator = UserSerializer(read_only=True)

    class Meta:
        model = Evaluation
        fields = ["id", "schedule", "evaluator", "verdict", "comments", "created_at"]


class DefenseResultSerializer(serializers.ModelSerializer):
    recorded_by = UserSerializer(read_only=True)

    class Meta:
        model = DefenseResult
        fields = ["id", "schedule", "verdict", "remarks", "recorded_by", "created_at"]


class DefenseScheduleSerializer(serializers.ModelSerializer):
    proposed_by = UserSerializer(read_only=True)
    approved_by = UserSerializer(read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    evaluations = EvaluationSerializer(many=True, read_only=True)
    result = DefenseResultSerializer(read_only=True)
    voters_total = serializers.SerializerMethodField()
    voters_evaluated = serializers.SerializerMethodField()
    suggested_verdict = serializers.SerializerMethodField()

    class Meta:
        model = DefenseSchedule
        fields = [
            "id", "group", "group_name", "stage", "date", "time",
            "duration_minutes", "location", "status", "remarks",
            "proposed_by", "approved_by", "evaluations", "result",
            "voters_total", "voters_evaluated", "suggested_verdict",
            "created_at", "updated_at",
        ]
        read_only_fields = ["status"]

    def _voter_ids(self, obj):
        voters = set()
        if obj.group.adviser_id:
            voters.add(obj.group.adviser_id)
        voters.update(
            obj.group.panel_assignments.filter(status="APPROVED").values_list("faculty_id", flat=True)
        )
        return voters

    def get_voters_total(self, obj):
        return len(self._voter_ids(obj))

    def get_voters_evaluated(self, obj):
        voters = self._voter_ids(obj)
        return len({e.evaluator_id for e in obj.evaluations.all() if e.evaluator_id in voters})

    def get_suggested_verdict(self, obj):
        verdicts = {e.verdict for e in obj.evaluations.all()}
        for candidate in VERDICT_SEVERITY:
            if candidate in verdicts:
                return candidate
        return None
