import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import client from '../../api/client'
import './users/styles.scss'

const KycReviews = () => {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('pending')

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const res = await client.get('/admin/kyc_reviews', {
        params: statusFilter ? { status: statusFilter } : {},
      })
      const data = res?.data?.data || []
      setReviews(Array.isArray(data) ? data : [])
    } catch (error) {
      toast(error?.response?.data?.message || 'Unable to load KYC reviews', { type: 'error' })
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const handleAction = async (reviewId, actionType) => {
    let reason = ''
    let notes = ''

    if (actionType === 'reject' || actionType === 'request_correction') {
      reason = window.prompt('Reason (required):', '') || ''
      if (!reason.trim()) {
        toast('Reason is required.', { type: 'error' })
        return
      }
    }

    notes = window.prompt('Notes (optional):', '') || ''

    try {
      await client.patch(`/admin/kyc_reviews/${reviewId}`, {
        action_type: actionType,
        reason: reason.trim(),
        notes: notes.trim(),
      })
      toast('Review updated', { type: 'success' })
      fetchReviews()
    } catch (error) {
      toast(error?.response?.data?.message || 'Unable to update review', { type: 'error' })
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h2>KYC Reviews</h2>
          <p>Manual BVN reviews and exceptions</p>
        </div>
        <div className="admin-page__filters">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="admin-select"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="in_review">In review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="admin-card">
        {loading ? (
          <p className="admin-empty">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="admin-empty">No reviews found.</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table__head">
              <span>User</span>
              <span>Status</span>
              <span>Reason</span>
              <span>Created</span>
              <span>Actions</span>
            </div>
            {reviews.map((review) => (
              <div className="admin-table__row" key={review.id}>
                <div>
                  <p className="admin-table__primary">{review?.user?.email || 'Unknown user'}</p>
                  <p className="admin-table__secondary">{review?.user?.id || ''}</p>
                </div>
                <div className="capitalize">{review.status || 'pending'}</div>
                <div className="capitalize">{review.reason || 'N/A'}</div>
                <div>{review.created_at ? new Date(review.created_at).toLocaleString() : 'N/A'}</div>
                <div className="admin-table__actions">
                  <button
                    type="button"
                    onClick={() => handleAction(review.id, 'approve')}
                    className="admin-action admin-action--approve"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(review.id, 'reject')}
                    className="admin-action admin-action--reject"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(review.id, 'request_correction')}
                    className="admin-action"
                  >
                    Request correction
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default KycReviews
