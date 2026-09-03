import Link from "next/link";

export default function EntryPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary items-center justify-center text-white text-2xl font-bold mb-3">M</div>
          <h1 className="text-2xl font-bold text-ink">MediQueue</h1>
          <p className="text-ink-2 text-sm mt-1">Your clinic visits, all in one place.</p>
        </div>
        <section className="card p-6 text-center">
          <h2 className="text-lg font-bold text-ink">Patient Portal</h2>
          <p className="text-sm text-ink-2 mt-2 mb-5">Register, sign in, book visits, and view your health history.</p>
          <Link href="/patient/login" className="btn-primary w-full">Patient Sign In</Link>
        </section>
      </div>
    </div>
  );
}
