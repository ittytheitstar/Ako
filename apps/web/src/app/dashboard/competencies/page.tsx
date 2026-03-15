'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { CompetencyProfile, CompetencyEvidence, CompetencyFramework } from '@ako/shared';

const RATING_COLORS: Record<string, string> = {
  not_yet:    'bg-gray-200 text-gray-700',
  beginning:  'bg-red-100 text-red-800',
  developing: 'bg-amber-100 text-amber-800',
  proficient: 'bg-green-100 text-green-800',
  advanced:   'bg-teal-100 text-teal-800',
};

const RATING_LABELS: Record<string, string> = {
  not_yet:    'Not Yet',
  beginning:  'Beginning',
  developing: 'Developing',
  proficient: 'Proficient',
  advanced:   'Advanced',
};

function RatingBadge({ rating }: { rating: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${RATING_COLORS[rating] ?? 'bg-gray-100 text-gray-600'}`}>
      {RATING_LABELS[rating] ?? rating}
    </span>
  );
}

export default function MyCompetenciesPage() {
  const qc = useQueryClient();
  const [selectedCompetency, setSelectedCompetency] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState('');

  // For a real app the userId would come from the auth context; using 'me' as placeholder
  const userId = 'me';

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['competency-profile', userId],
    queryFn: () => apiClient.getCompetencyProfile(userId),
  });

  const { data: evidenceData } = useQuery({
    queryKey: ['competency-evidence-detail', selectedCompetency],
    queryFn: () => apiClient.getCompetencyEvidence({ competency_id: selectedCompetency! }),
    enabled: !!selectedCompetency,
  });

  const { data: frameworksData } = useQuery({
    queryKey: ['competency-frameworks'],
    queryFn: () => apiClient.getCompetencyFrameworks(),
  });

  const profiles = (profileData?.data ?? []) as CompetencyProfile[];
  const evidenceList = (evidenceData?.data ?? []) as CompetencyEvidence[];
  const frameworks = (frameworksData?.data ?? []) as CompetencyFramework[];

  // Group profiles by framework
  const byFramework = new Map<string, CompetencyProfile[]>();
  for (const p of profiles) {
    const fid = p.framework_id ?? 'unknown';
    if (!byFramework.has(fid)) byFramework.set(fid, []);
    byFramework.get(fid)!.push(p);
  }

  function getFrameworkName(fid: string) {
    return frameworks.find(f => f.framework_id === fid)?.name ?? fid;
  }

  function handleExportCsv() {
    setExportMsg('Preparing CSV transcript…');
    apiClient.getCompetencyTranscript(userId, 'csv')
      .then(() => setExportMsg('Transcript ready (check Downloads)'))
      .catch(() => setExportMsg('Export failed'));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Competencies</h1>
        <button
          onClick={handleExportCsv}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
        >
          Export Transcript (CSV)
        </button>
      </div>

      {exportMsg && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
          {exportMsg}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(RATING_LABELS).map(([key, label]) => (
          <span key={key} className={`px-2 py-1 rounded text-xs font-medium ${RATING_COLORS[key]}`}>
            {label}
          </span>
        ))}
      </div>

      {isLoading && <p className="text-gray-500">Loading competency data…</p>}

      {profiles.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No competency data yet</p>
          <p className="text-sm mt-1">Complete activities tagged to competencies to see your progress here.</p>
        </div>
      )}

      {/* Profiles grouped by framework */}
      {Array.from(byFramework.entries()).map(([fid, fProfiles]) => (
        <div key={fid} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">{getFrameworkName(fid)}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {fProfiles.map(profile => (
              <div
                key={profile.competency_id}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedCompetency(
                  selectedCompetency === profile.competency_id ? null : profile.competency_id
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">
                      {profile.competency_short_name ?? profile.competency_id}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {profile.evidence_count} evidence item{profile.evidence_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <RatingBadge rating={profile.proficiency_rating} />
                </div>

                {/* Evidence drill-down */}
                {selectedCompetency === profile.competency_id && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Evidence</p>
                    {evidenceList.length === 0 && (
                      <p className="text-sm text-gray-500">No evidence records found.</p>
                    )}
                    {evidenceList.map(ev => (
                      <div key={ev.evidence_id} className="flex items-start gap-3 text-sm border border-gray-100 rounded p-2">
                        <RatingBadge rating={ev.proficiency_rating} />
                        <div className="flex-1">
                          <span className="capitalize text-gray-700">{ev.source_type.replace('_', ' ')}</span>
                          {ev.notes && <p className="text-gray-500 text-xs mt-0.5">{ev.notes}</p>}
                        </div>
                        <span className="text-xs text-gray-400">{ev.evidence_date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
