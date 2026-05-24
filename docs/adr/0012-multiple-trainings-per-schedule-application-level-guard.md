# Multiple Trainings per Schedule enforced at application layer, not DB

A user may have more than one Training per Schedule once a prior one is terminal. The DB-level unique constraint on `(user_id, schedule_id)` was removed in favour of an application-level check in `create_training` that blocks creation only when a non-terminal Training (`aborted_at IS NULL AND completed_at IS NULL`) already exists for that user/schedule pair.

The DB constraint was removed because re-enrollment after aborting a Training is an intended user flow. Soft-deleting or replacing the aborted Training was rejected because it destroys history — aborted Trainings remain in the DB and appear as separate rows in the Training list.
