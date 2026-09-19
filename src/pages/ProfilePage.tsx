import { useState } from 'react';
import { Save, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

export default function ProfilePage() {
	const { profile, refreshProfile } = useAuth();
	const [form, setForm] = useState({
		full_name: profile?.full_name ?? '',
		department: profile?.department ?? '',
		enrollment_number: profile?.enrollment_number ?? '',
		semester: profile?.semester?.toString() ?? '',
		year: profile?.year?.toString() ?? '',
		designation: profile?.designation ?? '',
	});
	const [saved, setSaved] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	if (!profile) return null;

	const update = (key: string, value: string) =>
		setForm((prev) => ({ ...prev, [key]: value }));

	const save = async () => {
		setErrorMsg(null);
		try {
			const { error } = await supabase
				.from('profiles')
				.update({
					...form,
					semester: form.semester ? Number(form.semester) : null,
					year: form.year ? Number(form.year) : null,
				})
				.eq('id', profile.id);

			if (error) {
				console.error('Profile save error:', error);
				setErrorMsg(error.message ?? 'Failed to save profile');
				return;
			}

			await refreshProfile();
			setSaved(true);
			setTimeout(() => setSaved(false), 2500);
		} catch (err) {
			console.error('Unexpected profile save error:', err);
			setErrorMsg('Unexpected error while saving profile. Check console.');
		}
	};

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div>
				<p className="text-sm font-medium text-blue-600">Account settings</p>
				<h1 className="mt-1 text-2xl font-bold text-slate-900">My Profile</h1>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-6">
				<div className="mb-6 flex items-center gap-4">
					<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-xl font-bold text-blue-700">
						{profile.full_name.charAt(0)}
					</div>
					<div>
						<h2 className="font-semibold text-slate-900">{profile.full_name}</h2>
						<p className="text-sm text-slate-500">
							{profile.email} · <span className="capitalize">{profile.role}</span>
						</p>
					</div>
				</div>

				{errorMsg && (
					<div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
						{errorMsg}
					</div>
				)}

				<div className="grid gap-4 sm:grid-cols-2">
					{[
						['full_name', 'Full name'],
						['department', 'Department'],
						['enrollment_number', 'Enrollment number'],
						['semester', 'Semester'],
						['year', 'Year'],
						['designation', 'Designation'],
					].map(([key, label]) => (
						<label key={key} className="text-sm font-medium text-slate-600">
							{label}
							<input
								value={form[key as keyof typeof form]}
								onChange={(e) => update(key, e.target.value)}
								className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400"
							/>
						</label>
					))}
				</div>

				<button
					onClick={save}
					className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
				>
					<Save className="h-4 w-4" /> {saved ? 'Saved' : 'Save profile'}
				</button>
			</div>
		</div>
	);
}
