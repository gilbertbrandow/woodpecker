# Hard block on concurrent active Runs across Trainings

A user may be enrolled in multiple Trainings (one per Schedule), but may only have one active Run at a time across all of them. `start_run` checks for any active Run across the user's Trainings before creating a new one and returns an error if one is found. The frontend surfaces this via a Sonner toast.

The soft alternative — a UI warning that still allows the user to proceed — was rejected. With the Woodpecker Method being single-focus by design and the user base small, two concurrent active Runs is almost certainly a mistake rather than intentional. A hard block prevents confusing dashboard state without meaningful loss of flexibility.
