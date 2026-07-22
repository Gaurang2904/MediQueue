import { getHealthSummary } from "@/lib/db";

export default function HealthProfileCard({ patient }) {
  const health = getHealthSummary(patient);

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-ink mb-4">Health Profile</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="stat-tile">
          <div className="stat-tile-value">{health.bmi ?? "—"}</div>
          <div className="stat-tile-label">BMI · {health.bmiCategory}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">
            {health.bpSystolic && health.bpDiastolic ? `${health.bpSystolic}/${health.bpDiastolic}` : "—"}
          </div>
          <div className="stat-tile-label">BP · {health.bpCategory}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{patient.bloodGroup || "—"}</div>
          <div className="stat-tile-label">Blood Group</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value capitalize">{patient.mobility || "—"}</div>
          <div className="stat-tile-label">Mobility</div>
        </div>
      </div>

      <ul className="text-sm text-ink-2 space-y-1.5">
        <li>
          <span className="font-medium text-ink">Past disease history: </span>
          {patient.pastDiseaseHistory ? patient.pastDiseaseDetails || "Yes" : "None reported"}
        </li>
        <li>
          <span className="font-medium text-ink">Allergies: </span>
          {patient.allergies ? patient.allergyDetails || "Yes" : "None reported"}
        </li>
        <li>
          <span className="font-medium text-ink">Dietary restrictions: </span>
          {patient.dietaryRestrictions ? "Yes" : "None reported"}
        </li>
      </ul>
    </div>
  );
}
