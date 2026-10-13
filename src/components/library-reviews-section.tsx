'use client'

import { useState, useEffect, useCallback } from "react"
import { 
  Star, 
  CheckCircle2, 
  BadgeCheck, 
  MessageSquare, 
  Loader2, 
  Send, 
  Sparkles
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { 
  getLibraryReviews, 
  submitLibraryReview, 
  type LibraryReviewsResponse 
} from "@/app/actions/review-actions"
import { formatStandardDate } from "@/lib/date-utils"

interface LibraryReviewsSectionProps {
  libraryId: string
  libraryName: string
  studentId?: string | null
}

const RATING_LABELS: Record<number, string> = {
  1: "Poor experience",
  2: "Fair / Needs improvement",
  3: "Average study space",
  4: "Good / Recommended",
  5: "Excellent / Highly recommended",
}

export function LibraryReviewsSection({
  libraryId,
  libraryName,
  studentId: initialStudentId,
}: LibraryReviewsSectionProps) {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [reviewsData, setReviewsData] = useState<LibraryReviewsResponse>({
    reviews: [],
    stats: {
      averageRating: 0,
      totalReviews: 0,
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    currentUserReview: null,
    isCurrentUserEnrolled: false,
    currentUserId: initialStudentId || null,
  })

  // Form State
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [content, setContent] = useState<string>("")
  const [filterMode, setFilterMode] = useState<"ALL" | "VERIFIED">("ALL")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refetchReviews = useCallback(async () => {
    try {
      setIsLoading(true)
      setLoadError(null)
      const data = await getLibraryReviews(libraryId)
      setReviewsData(data)
      if (data.currentUserReview) {
        setRating(data.currentUserReview.rating)
        setContent(data.currentUserReview.content)
      }
    } catch (err) {
      console.error("Failed to load reviews:", err)
      setLoadError("Unable to load reviews right now. Please try again later.")
      toast.error("Failed to load reviews.")
    } finally {
      setIsLoading(false)
    }
  }, [libraryId])

  useEffect(() => {
    let ignore = false

    getLibraryReviews(libraryId)
      .then((data) => {
        if (!ignore) {
          setReviewsData(data)
          if (data.currentUserReview) {
            setRating(data.currentUserReview.rating)
            setContent(data.currentUserReview.content)
          }
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Failed to load reviews:", err)
          setLoadError("Unable to load reviews right now. Please try again later.")
          toast.error("Failed to load reviews.")
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [libraryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reviewsData.currentUserId) {
      router.push(`/login?returnUrl=/library/${libraryId}`)
      return
    }

    if (!content.trim() || content.trim().length < 3) {
      toast.error("Please write at least 3 characters for your review.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await submitLibraryReview({
        libraryId,
        rating,
        content: content.trim(),
      })

      if (res.success) {
        toast.success(res.message || "Review submitted successfully!")
        setShowForm(false)
        await refetchReviews()
      } else {
        toast.error(res.error || "Failed to submit review.")
      }
    } catch (err) {
      console.error("Review submission error:", err)
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const { reviews, stats, currentUserReview, isCurrentUserEnrolled, currentUserId } = reviewsData

  const filteredReviews = reviews.filter((r) => {
    if (filterMode === "VERIFIED") return r.isVerified
    return true
  })

  return (
    <section id="reviews-section" className="mt-12 border-t border-border pt-10 scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-foreground">
              Student Reviews & Ratings
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Authentic experiences shared by students of {libraryName}
          </p>
        </div>

        <div>
          {!showForm && (
            <button
              onClick={() => {
                if (!currentUserId) {
                  router.push(`/login?returnUrl=/library/${libraryId}`)
                  return
                }
                setShowForm(true)
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              {currentUserReview ? "Edit Your Review" : "Write a Review"}
            </button>
          )}
        </div>
      </div>

      {/* Review Submission Card / Modal */}
      {showForm && (
        <div className="mb-10 bg-card border border-border shadow-md rounded-2xl p-6 sm:p-8 animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">
              {currentUserReview ? "Update Your Review" : "Share Your Experience"}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>

          {/* Verification Status Pill */}
          <div className="mb-6">
            {isCurrentUserEnrolled ? (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800/60">
                <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  <strong>Enrolled Student:</strong> You have a confirmed seat/locker booking at this library. Your review will be published with a <strong>Verified Student</strong> badge.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/60 text-muted-foreground text-xs font-medium border border-border">
                <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>
                  You are reviewing as a visitor/student. Enrolled members with an active or confirmed booking at this library automatically receive a Verified badge.
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Star Rating Picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Overall Rating
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || rating) >= star
                    return (
                      <button
                        type="button"
                        key={star}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        className="p-1 rounded-lg hover:scale-110 transition-transform focus:outline-none"
                      >
                        <Star
                          className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                            active
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30 hover:text-amber-300"
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {RATING_LABELS[hoverRating || rating]}
                </span>
              </div>
            </div>

            {/* Review text */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Your Review
                </label>
                <span className="text-xs text-muted-foreground">
                  {content.length}/1000
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={1000}
                placeholder="How was the study environment? Share details about Wi-Fi speed, silence, AC, chair comfort, washrooms, or librarian support..."
                rows={4}
                className="w-full p-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !content.trim() || content.trim().length < 3}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {currentUserReview ? "Update Review" : "Publish Review"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Aggregate Rating Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-card border border-border p-6 sm:p-8 rounded-3xl mb-8 shadow-sm">
        {/* Score column */}
        <div className="flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-border">
          <div className="text-5xl font-black font-heading text-foreground mb-2">
            {stats.totalReviews > 0 ? stats.averageRating : "—"}
          </div>
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-5 h-5 ${
                  stats.totalReviews > 0 && s <= Math.round(stats.averageRating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <p className="text-xs font-semibold text-muted-foreground">
            {stats.totalReviews > 0
              ? `Based on ${stats.totalReviews} student ${stats.totalReviews === 1 ? "review" : "reviews"}`
              : "No reviews yet"}
          </p>
        </div>

        {/* Rating Breakdown Bars */}
        <div className="md:col-span-2 flex flex-col justify-center gap-2 px-2 sm:px-6">
          {[5, 4, 3, 2, 1].map((score) => {
            const count = stats.ratingCounts[score] || 0
            const percentage = stats.totalReviews > 0 ? Math.round((count / stats.totalReviews) * 100) : 0
            return (
              <div key={score} className="flex items-center gap-3 text-xs">
                <span className="w-7 font-bold text-foreground flex items-center gap-1">
                  {score} <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline" />
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-10 text-right text-muted-foreground font-medium">
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter Tabs */}
      {reviews.length > 0 && (
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filterMode === "ALL"
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All Reviews ({reviews.length})
            </button>
            <button
              onClick={() => setFilterMode("VERIFIED")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filterMode === "VERIFIED"
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified Only ({reviews.filter((r) => r.isVerified).length})
            </button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
          <p className="text-sm font-medium">Loading verified reviews...</p>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-destructive/5 border border-destructive/20 rounded-3xl text-center">
          <MessageSquare className="w-10 h-10 text-destructive/40 mb-3" />
          <h4 className="text-base font-bold text-foreground mb-1">
            Could not load reviews
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mb-5">
            {loadError}
          </p>
          <button
            onClick={() => refetchReviews()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-muted/20 border border-border/60 rounded-3xl text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <h4 className="text-base font-bold text-foreground mb-1">
            {filterMode === "VERIFIED"
              ? "No verified student reviews yet"
              : "No reviews for this library yet"}
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mb-5">
            {filterMode === "VERIFIED"
              ? "None of the current reviews are from enrolled students yet."
              : "Be the first student to review this library and help others decide!"}
          </p>
          {!showForm && (
            <button
              onClick={() => {
                if (!currentUserId) {
                  router.push(`/login?returnUrl=/library/${libraryId}`)
                  return
                }
                setShowForm(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-opacity"
            >
              Write the First Review
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredReviews.map((rev) => {
            const initial = rev.student.name ? rev.student.name.charAt(0).toUpperCase() : "S"
            return (
              <div
                key={rev.id}
                className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between hover:border-border transition-colors"
              >
                <div>
                  {/* Top user row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {rev.student.profilePhotoUrl ? (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-border shrink-0">
                          <Image
                            src={rev.student.profilePhotoUrl}
                            alt={rev.student.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20 shrink-0">
                          {initial}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center flex-wrap gap-2">
                          <h4 className="font-bold text-sm text-foreground">
                            {rev.student.name}
                          </h4>

                          {/* Verified Tick Marked Badge for enrolled students */}
                          {rev.isVerified ? (
                            <span 
                              title="Verified student enrolled in this library" 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            >
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Verified
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-normal">
                              Student
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatStandardDate(new Date(rev.createdAt))}
                        </p>
                      </div>
                    </div>

                    {/* Rating stars */}
                    {rev.rating > 0 && (
                      <div className="flex items-center gap-0.5 shrink-0 bg-muted/40 px-2 py-1 rounded-lg">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-xs font-bold text-foreground">
                          {rev.rating}.0
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Review text */}
                  <p className="text-sm text-foreground/90 leading-relaxed break-words whitespace-pre-line mt-2">
                    {rev.content}
                  </p>
                </div>

                {/* Logged in student's own indicator */}
                {currentUserId === rev.student.id && (
                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground italic">Your review</span>
                    <button
                      onClick={() => setShowForm(true)}
                      className="text-primary font-bold hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
