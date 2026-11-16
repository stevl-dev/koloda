# Concepts

What the app's scheduling terms mean for a learner, and how to choose their values.

## Spaced Repetition

The app schedules each card with FSRS, a spaced repetition algorithm.
FSRS estimates how well the user remembers each card and when that memory will fade.
It shows the card again shortly before the user would likely forget it.
Each successful review makes the memory more stable, so the next gap is longer.
A forgotten card comes back soon and starts building its gaps again.

The settings that shape this belong to an algorithm preset, listed under Presets.
Each deck uses one preset.
The parameters and their allowed values are ALGORITHMS.md (§Parameters).
How a card moves between untouched, learn, review, and relearn is CARDS.md (§Card State).

## Grades

After revealing a card, the user grades how well they recalled it.
Each grade button shows when the card would come back with that grade; see LESSONS.md (§Grading).

- **Again** — the user did not recall the answer, or recalled it wrong.
- **Hard** — the user recalled the answer, but only with serious effort or hesitation.
- **Good** — the user recalled the answer with the usual effort.
- **Easy** — the user recalled the answer at once, with no effort.

Again is the only failing grade.
Hard, Good, and Easy all count as remembered.

Grade honestly, by whether the answer came back, not by how the user feels about the card.
If the answer did not come back, grade Again, even when it was almost right.
If it came back slowly but correctly, grade Hard, not Again.
Grading Hard on a forgotten card makes the next gap too long.
Grading Again on a remembered card makes it come back too soon.

Again on a card in review counts as a lapse.
The card's memory estimate drops, and it goes through the relearning steps, if the preset has any.
With no relearning steps, it stays in review with a much shorter gap.

Hard grows the gap less than Good.
Easy grows it more than Good.

Honest grades matter most when the weights are fitted to the user's reviews; see §Weights.

## Desired Retention

Retention is the chance, as a percentage, that the user still remembers a card on the day it comes back.
FSRS sets each gap so that the predicted chance of recall falls to this value when the card is due.

Raising retention makes gaps shorter.
The user reviews more often and forgets less.
Lowering retention makes gaps longer.
The user reviews less often and forgets more.

The cost grows steeply near the top of the range.
With the built-in weights, a gap at 95 is about two-fifths of the gap at 90.
At 97 it is under a quarter, and at 99 it is about a fifteenth.
At 80 it is more than three times the gap at 90.

The built-in preset uses 90.
A higher value suits material the user must not forget by a fixed date, such as an exam, and costs more reviews.
A lower value suits a large collection with little study time, and costs more forgotten cards.
Changing retention affects later grades only; see ALGORITHMS.md (§What it is).

## Learning and Relearning Steps

Steps are short, fixed delays used before FSRS takes over.
Learning steps apply to a new card.
Relearning steps apply to a card that lapsed from review.

While a card is on its steps:

- Again sends it back to the first step.
- Hard keeps it on its current step, with a delay between the first and second steps.
- Good moves it forward; once it has passed its steps, it graduates to review.
- Easy graduates it to review at once.

Steps let the user see a new or forgotten card again within the same session.
With learn-ahead, a card due within the next few minutes can come back in the same lesson;
see LEARNING-SETTINGS.md (§Learn Ahead).

A step of a day or longer is still followed, but the card counts as review from then on.
Empty steps send a new card straight to review on its first grade.

The built-in preset uses learning steps of 1 minute and 10 minutes, and one relearning step of 10 minutes.

## Fuzz

Fuzz adds a small random shift to each gap of more than a couple of days.
Cards added and studied together then spread over nearby days instead of all coming due at once.
The shift grows with the gap and never passes the maximum interval.

The built-in preset has fuzz on.
Turning it off makes gaps exact and repeatable, at the cost of uneven days.

## Maximum Interval

The maximum interval is the longest gap, in days, that a card can get.
No card is scheduled further ahead than this.

The built-in preset uses 36,500 days, about a hundred years, which in practice is no cap.
A lower value keeps even well-known cards coming back, at the cost of extra reviews.

## Weights

Weights are the twenty-one numbers FSRS uses to model memory.
They decide how fast memory fades and how much each grade changes it.

The built-in weights fit an average learner.
On the desktop app, the user can fit them to their own reviews; see ALGORITHMS.md (§Optimization).
The fitted weights predict that user's memory better, so the chosen retention is met more closely.
Editing weights by hand is possible but rarely useful.

## Daily Limits and Scheduling

Daily limits do not change when cards are due.
They only shape how many cards a lesson suggests; see LEARNING-SETTINGS.md (§Daily Limits).
Cards past their due time stay due until studied.
A long break leaves a backlog, not lost cards.
