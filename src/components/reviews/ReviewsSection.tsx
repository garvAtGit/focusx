'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Star, 
  PenSquare, 
  CheckCircle2, 
  Loader2, 
  Lock, 
  X, 
  Sparkles, 
  Globe2, 
  MessageSquareHeart 
} from 'lucide-react';
import { formatStandardDate } from '@/lib/date-utils';
import type { LibraryReview, LibraryReviewsSummary } from '@/lib/reviews-service';

interface ReviewsSectionProps {
  libraryId: string;
  libraryName: string;
  currentUserId?: string | null;
  onRatingLoaded?: (avg: number, count: number) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Disappointing — Needs improvement',
  2: 'Below Average — Several issues',
  3: 'Average — Decent place to study',
  4: 'Very Good — Quiet and comfortable',
  5: 'Excellent! — Highly recommended',
};

export function ReviewsSection({
  libraryId,
  libraryName,
  currentUserId,
  onRatingLoaded,
}: ReviewsSectionProps) {
  const router = useRouter();
  const [data, setData] = useState<LibraryReviewsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Form State
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewContent, setReviewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reviews?libraryId=${encodeURIComponent(libraryId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load reviews');
      const json = await res.json();
      if (json.success) {
        setData(json);
        if (onRatingLoaded) {
          onRatingLoaded(json.averageRating, json.totalReviews);
        }
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [libraryId, onRatingLoaded]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleOpenReviewModal = () => {
    if (!currentUserId) {
      setShowLoginPrompt(true);
      return;
    }
    setFormError(null);
    setSelectedRating(5);
    setReviewContent('');
    setIsModalOpen(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      setShowLoginPrompt(true);
      return;
    }

    if (!selectedRating || selectedRating < 1 || selectedRating > 5) {
      setFormError('Please select a star rating from 1 to 5');
      return;
    }

    if (!reviewContent.trim() || reviewContent.trim().length < 3) {
      setFormError('Please write at least a few words about your experience.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId,
          rating: selectedRating,
          content: reviewContent.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to submit review');
      }

      setIsModalOpen(false);
      setReviewContent('');
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 4000);
      await fetchReviews();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting review';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalReviews = data?.totalReviews ?? 0;
  const avgRating = data?.averageRating ?? 0;
  const distribution = data?.ratingDistribution ?? { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  return (
    <section id="reviews-section" className="mt-12 border-t border-border pt-10 scroll-mt-24">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5" />
          <div>
            <div className="font-bold text-sm">Review Submitted!</div>
            <div className="text-xs text-emerald-100">Thank you for helping fellow students.</div>
          </div>
        </div>
      )}

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </span>
            <h2 className="text-2xl font-black text-foreground font-heading tracking-tight">
              Student Reviews & Ratings
            </h2>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Real feedback from students studying at {libraryName}
          </p>
        </div>

        <button
          onClick={handleOpenReviewModal}
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl hover:opacity-90 shadow-sm transition-all shrink-0 active:scale-95"
        >
          <PenSquare className="w-4 h-4" />
          Write a Review
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">
          <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
          <p className="text-sm font-medium">Loading reviews...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Summary Card */}
          <div className="lg:col-span-4 bg-card rounded-3xl p-6 border border-border shadow-sm flex flex-col gap-6">
            <div className="flex items-baseline gap-3">
              <div className="text-5xl font-black font-heading text-foreground">
                {totalReviews > 0 ? avgRating.toFixed(1) : '—'}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        totalReviews > 0 && star <= Math.round(avgRating)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-xs text-muted-foreground font-medium mt-1">
                  {totalReviews === 0
                    ? 'No reviews yet'
                    : `Based on ${totalReviews} student review${totalReviews === 1 ? '' : 's'}`}
                </div>
              </div>
            </div>

            {/* Distribution Bars */}
            <div className="space-y-2 pt-2 border-t border-border">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = distribution[stars as keyof typeof distribution] || 0;
                const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                return (
                  <div key={stars} className="flex items-center gap-3 text-xs font-medium">
                    <span className="w-6 text-muted-foreground flex items-center gap-1 shrink-0">
                      {stars} <Star className="w-3 h-3 text-amber-400 fill-amber-400 inline" />
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-muted-foreground shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                onClick={handleOpenReviewModal}
                className="w-full bg-muted/60 hover:bg-muted text-foreground font-bold py-3 rounded-xl text-sm border border-border transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                Share Your Experience
              </button>
            </div>
          </div>

          {/* Right Column: Review Cards List */}
          <div className="lg:col-span-8 space-y-4">
            {totalReviews === 0 ? (
              <div className="bg-card rounded-3xl p-10 border border-border text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                  <MessageSquareHeart className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Be the first to review!</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Share your thoughts on seat comfort, Wi-Fi speed, silence, and facilities to help other students choose this library.
                  </p>
                </div>
                <button
                  onClick={handleOpenReviewModal}
                  className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-xl hover:opacity-90 shadow-sm transition-all inline-flex items-center gap-2 text-sm"
                >
                  <PenSquare className="w-4 h-4" />
                  Write First Review
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {data?.reviews.map((rev) => {
                  const initials = rev.userName
                    ? rev.userName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                    : 'ST';

                  return (
                    <div
                      key={rev.id}
                      className="bg-card rounded-2xl p-5 border border-border shadow-sm hover:border-border/80 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {rev.userAvatar ? (
                            <img
                              src={rev.userAvatar}
                              alt={rev.userName}
                              className="w-10 h-10 rounded-full object-cover border border-border"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0 border border-primary/20">
                              {initials}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-foreground text-sm">{rev.userName}</h4>
                              {rev.source === 'LIBRARY_NEAR' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                  <Globe2 className="w-3 h-3" /> via Library Near
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> Verified Student
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatStandardDate(rev.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Stars */}
                        <div className="flex items-center gap-0.5 shrink-0 bg-muted/40 px-2 py-1 rounded-lg">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${
                                star <= rev.rating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-muted-foreground/30'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Content */}
                      <p className="text-sm text-foreground/90 leading-relaxed font-sans pl-1">
                        {rev.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Write a Review Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-background w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-border relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 mb-6">
              <h3 className="text-2xl font-black font-heading text-foreground">
                Review {libraryName}
              </h3>
              <p className="text-sm text-muted-foreground">
                Rate your overall experience and help fellow students make the right choice.
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-6">
              {/* Star Rating Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Overall Rating
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating ?? selectedRating) >= star;
                    return (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setSelectedRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 focus:outline-none transition-transform hover:scale-125 active:scale-95"
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            active
                              ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                              : 'text-muted-foreground/30 hover:text-amber-200'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs font-semibold text-primary mt-2">
                  {RATING_LABELS[hoverRating ?? selectedRating]}
                </div>
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Your Review
                </label>
                <textarea
                  rows={4}
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="How was the study environment? (e.g. WiFi speed, silence level, AC temperature, chair comfort, washroom cleanliness...)"
                  className="w-full p-4 border border-border rounded-2xl bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground resize-none transition-shadow"
                  maxLength={1000}
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                  <span>Minimum 3 characters</span>
                  <span>{reviewContent.length} / 1000</span>
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
                  {formError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 font-bold text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !reviewContent.trim()}
                  className="px-6 py-2.5 font-bold text-sm bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isSubmitting ? 'Posting...' : 'Post Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Login Prompt Dialog (When non-logged-in user tries to review) */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-background w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl border border-border text-center space-y-5">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto border border-primary/20">
              <Lock className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black font-heading text-foreground">
                Sign in to Write a Review
              </h3>
              <p className="text-sm text-muted-foreground">
                To keep library ratings authentic and trustworthy, students must sign in before submitting a review.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => {
                  router.push(`/login?returnUrl=/library/${encodeURIComponent(libraryId)}`);
                }}
                className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity shadow-md text-sm"
              >
                Sign In to Continue
              </button>
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="w-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground font-bold py-3 rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

