import Link from "next/link";

export default function StaffEntryPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-sidebar items-center justify-center text-white text-2xl font-bold mb-3">M</div>
          <h1 className="text-2xl font-bold text-ink">MediQueue Staff</h1>
          <p className="text-ink-2 text-sm mt-1">Choose your staff role.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <section className="card p-6 text-center">
            <h2 className="text-lg font-bold text-ink">Doctor Portal</h2>
            <p className="text-sm text-ink-2 mt-2 mb-5">Manage appointments, patient records, consultations, and payments.</p>
            <Link href="/doctor/login" className="btn-primary w-full">Doctor Sign In</Link>
          </section>
          <section className="card p-6 text-center">
            <h2 className="text-lg font-bold text-ink">Staff Login</h2>
            <p className="text-sm text-ink-2 mt-2 mb-5">Verify payments and track patient status at the front desk.</p>
            <Link href="/registration/login" className="btn-outline w-full">Staff Sign In</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
