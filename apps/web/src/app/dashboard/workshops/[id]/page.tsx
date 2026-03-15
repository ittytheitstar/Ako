'use client';
import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { WorkshopAssessment } from '@ako/shared';

const phaseLabels: Record<string, string> = {
  setup: 'Setup',
  submission: 'Submission',
  assessment: 'Peer Assessment',
  grading: 'Grading',
  closed: 'Closed',
};

const phaseColors: Record<string, string> = {
  setup: 'bg-gray-100 text-gray-700',
  submission: 'bg-blue-100 text-blue-700',
  assessment: 'bg-yellow-100 text-yellow-700',
  grading: 'bg-purple-100 text-purple-700',
  closed: 'bg-green-100 text-green-700',
};

export default function WorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const [subTitle, setSubTitle] = useState('');
  const [subBody, setSubBody] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<WorkshopAssessment | null>(null);
  const [assessGrades, setAssessGrades] = useState('{}');
  const [assessFeedback, setAssessFeedback] = useState('');

  const workshopQuery = useQuery({
    queryKey: ['workshop', id],
    queryFn: () => apiClient.getWorkshop(id),
  });

  const assessmentsQuery = useQuery({
    queryKey: ['workshop-assessments', id],
    queryFn: () => apiClient.getWorkshopAssessments(id),
  });

  const submitWorkshop = useMutation({
    mutationFn: () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(subBody || '{}'); } catch { /* ignore */ }
      return apiClient.submitWorkshop(id, { title: subTitle, body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workshop', id] });
      setSubTitle('');
      setSubBody('');
    },
  });

  const submitAssessment = useMutation({
    mutationFn: () => {
      let grades: Record<string, unknown> = {};
      try { grades = JSON.parse(assessGrades); } catch { /* ignore */ }
      return apiClient.submitWorkshopAssessment(id, selectedAssessment!.submission_id, {
        grades,
        feedback: assessFeedback || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workshop-assessments', id] });
      setSelectedAssessment(null);
      setAssessGrades('{}');
      setAssessFeedback('');
    },
  });

  const workshop = workshopQuery.data;
  const assessments = assessmentsQuery.data?.data ?? [];

  if (workshopQuery.isLoading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (workshopQuery.isError || !workshop) return <div className="p-6 text-red-600">Failed to load workshop.</div>;

  const phase = workshop.phase;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workshop</h1>
          <p className="text-sm text-gray-500 mt-1">
            Peer count: {workshop.peer_count} · Self-assessment: {workshop.self_assessment ? 'Yes' : 'No'}
          </p>
        </div>
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${phaseColors[phase] ?? 'bg-gray-100 text-gray-700'}`}>
          {phaseLabels[phase] ?? phase}
        </span>
      </div>

      {phase === 'submission' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Submit Your Work</h2>
          {workshop.submission_end_at && (
            <p className="text-sm text-gray-500">Due: {new Date(workshop.submission_end_at).toLocaleString()}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              placeholder="Submission title"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Body (JSON)</label>
            <textarea
              rows={5}
              value={subBody}
              onChange={(e) => setSubBody(e.target.value)}
              placeholder='{"content": "Your submission text..."}'
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <button
            onClick={() => submitWorkshop.mutate()}
            disabled={!subTitle || submitWorkshop.isPending}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {submitWorkshop.isPending ? 'Submitting…' : 'Submit'}
          </button>
          {submitWorkshop.isSuccess && (
            <p className="text-green-600 text-sm">✓ Submission recorded.</p>
          )}
        </div>
      )}

      {phase === 'assessment' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Peer Assessments</h2>
          {workshop.assessment_end_at && (
            <p className="text-sm text-gray-500">Due: {new Date(workshop.assessment_end_at).toLocaleString()}</p>
          )}
          {assessmentsQuery.isLoading ? (
            <p className="text-gray-500 text-sm">Loading assessments…</p>
          ) : assessments.length === 0 ? (
            <p className="text-gray-400 text-sm">No assessments assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {assessments.map((a) => (
                <div key={a.assessment_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">Submission #{a.submission_id.slice(-6)}</span>
                    {a.submitted_at ? (
                      <span className="text-xs text-green-600 font-medium">✓ Submitted</span>
                    ) : (
                      <button
                        onClick={() => setSelectedAssessment(a)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Assess
                      </button>
                    )}
                  </div>
                  {a.feedback && <p className="text-xs text-gray-500 mt-1">{a.feedback}</p>}
                </div>
              ))}
            </div>
          )}

          {selectedAssessment && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-blue-900">
                Assessing submission #{selectedAssessment.submission_id.slice(-6)}
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Grades (JSON)</label>
                <textarea
                  rows={3}
                  value={assessGrades}
                  onChange={(e) => setAssessGrades(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Feedback</label>
                <textarea
                  rows={2}
                  value={assessFeedback}
                  onChange={(e) => setAssessFeedback(e.target.value)}
                  placeholder="Constructive feedback…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => submitAssessment.mutate()}
                  disabled={submitAssessment.isPending}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitAssessment.isPending ? 'Saving…' : 'Submit Assessment'}
                </button>
                <button onClick={() => setSelectedAssessment(null)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {(phase === 'setup' || phase === 'grading' || phase === 'closed') && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500">
          <p className="text-sm">
            {phase === 'setup' && 'The workshop has not started yet.'}
            {phase === 'grading' && 'Assessments are being reviewed. Grades will be released soon.'}
            {phase === 'closed' && 'This workshop is closed. Check your grades in the gradebook.'}
          </p>
        </div>
      )}
    </div>
  );
}
