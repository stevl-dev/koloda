# Algorithms

## Scope

Covers algorithm presets: parameters, adding, cloning, editing, optimizing weights, deleting with a successor,
and parameter history.
Does not cover how grades update card state (CARDS.md) or the learning settings UI (LEARNING-SETTINGS.md).
FSRS scheduling math is out of scope too; it has no product spec.
How decks pick an algorithm is covered lightly; deck management itself is not.

## What it is

An algorithm is a named FSRS-7 parameter set used by decks when scheduling cards.
It can also carry optional notes.
The product lists these under Presets.
Each deck points at one algorithm.
Editing an algorithm, or pointing a deck at a different algorithm, changes the parameters used for later grades.
It does not rewrite existing card scheduling numbers until those cards are graded again.
Applying optimized weights is the one exception; see §Optimization.
Its weights can be fitted to the user's own reviews; see §Optimization.

## Core model

- **Algorithm** — a titled FSRS preset
- **Notes** — optional text the user writes about the algorithm
- **Parameters** — retention, weights, fuzz, learning steps, relearning steps, and maximum interval
- **Optimization** — fitting an algorithm's weights to the review history of the cards that use it
- **Successor** — another algorithm that takes over decks when one is deleted
- **Revision** — a recorded set of parameters, with when it was recorded and who made the change
- **History** — the revisions of one algorithm, oldest first

### Relationships

- A deck stores which algorithm to use and uses that algorithm's current parameters when grading.
- Cards do not store an algorithm of their own; see DECKS.md (§Relationships).
- See LEARNING-SETTINGS.md (§Defaults) for the default algorithm offered when creating a deck.

## Parameters

Every algorithm is FSRS and has:

- **Retention** — integer from 70 through 99
- **Fuzz** — on or off
- **Weights** — exactly thirty-four comma-separated numbers
- **Learning steps** — ordered delays used while a card is in learning
- **Relearning steps** — ordered delays used while a card is in relearning
- **Maximum interval** — a whole number of days, at least one

A step is the shortest delay at that point.
When FSRS predicts the card is remembered for longer, it uses its longer delay instead.
A delay of a day or more takes the card to review, skipping the steps left.

Each learning or relearning step is an amount and a unit.
Units are seconds, minutes, hours, or days.
The amount is a whole number, at least one.
Either step list may be empty.

Adding a step copies the previous step when one exists.
Otherwise it uses the built-in default first step for that list.
Steps can be removed individually.

Invalid parameters are rejected on save.
The previous saved algorithm remains unchanged.

## Adding Algorithms

The user adds an algorithm by giving it a title.
Two algorithms may have the same title; they remain distinct.
The new algorithm starts from the built-in FSRS defaults for all parameters.
A new algorithm has no notes.

After a successful add, the dialog offers a link to open the new algorithm.
Changing the title again clears that success state so another add can be submitted.

The title is required and at most 255 characters long.
Some characters, such as emoji, count as two toward this limit.
Leading and trailing whitespace is stripped before a title is saved.
A title that is empty or contains only whitespace is rejected.

## Cloning Algorithms

The user can clone any algorithm.
Clone asks for a new title and copies the source parameters into an independent algorithm.

Clone does not copy decks, notes, or history.
The clone's history starts with its own first revision; see §History.
After success, the dialog offers a link to open the clone.

Cloning a missing source fails and creates nothing.

## Editing Algorithms

The algorithm editor shows timestamps, title, notes, parameters, and actions.
Saving applies title, notes, and parameters together.
Discard restores the last saved values.

Notes are optional.
Leading and trailing whitespace is stripped before notes are saved.
Notes that are empty or contain only whitespace are not kept.
Notes are limited to 1,024 characters.
Some characters, such as emoji, count as two toward this limit.
Changing notes does not change scheduling parameters.
See ASSISTANT-DATA-ACCESS.md (§Resources) for how the assistant reads notes.

See §What it is for when changed parameters take effect.
A save that changes parameters adds a revision; see §History.
The learning settings default algorithm can be edited while it remains the default.
See LEARNING-SETTINGS.md (§Defaults).

## Optimization

Optimization fits an algorithm's weights to the user's own review history.
Only the weights change.
Retention, fuzz, learning steps, relearning steps, and maximum interval stay as they are.

The desktop app offers optimization from the algorithm editor.
The web app offers no optimization and shows nothing in its place.

Optimization learns from the reviews of the cards in decks that use the algorithm when it starts.
It uses only cards whose history the app holds from their first grade.
That includes reviews made while a card's deck used another algorithm.

It starts from the saved parameters.
It is unavailable while the editor has unsaved changes.

While it runs, the user sees its progress and can cancel it.
Closing the optimization dialog also cancels it.
A cancelled optimization changes nothing.

An optimization ends with one of these results:

- **Not enough reviews** — the cards do not yet have enough reviews to fit weights from
- **Already the best fit** — the current weights predict the reviews at least as well as the weights it found
- **New weights** — the weights it found predict the reviews better than the current ones

With few reviews to learn from, or none a day or more after the card's previous review, it reports Not enough reviews.
It does not offer weights it could not fit.

The last two results show how many reviews were used.
They also show how well the current and the found weights fit those reviews, as two error scores.
A lower score is a better fit.

Only new weights can be applied.
The user applies or discards them.
Discarding changes nothing.

Applying replaces the algorithm's weights.
It leaves the other parameters, the title, and the notes unchanged.
Applied weights affect later grades like any other parameter change.
Applying records a revision; see §History.

Applying also recomputes the memory of the cards in decks that use the algorithm when the weights are applied.
Each card's stability and difficulty become what grading its reviews with the new weights would have given.
It reads the same reviews optimization learns from.
A card whose history the app does not hold from its first grade keeps its numbers, and so does a card never graded.
Due times, intervals, and the other scheduling numbers stay as they are, until each card's next grade.
The recomputed numbers reach the user's other devices like a grade's.

If the algorithm's parameters changed after the optimization started, applying is refused.
The weights stay as they are, and the user can optimize again.

Running an optimization changes nothing until its weights are applied, and applying changes no reviews.
There is no automatic optimization; it runs only when the user starts it.

## Deleting Algorithms

Delete asks for confirmation.
On success the user is returned to the algorithms list.

Delete is unavailable when either of these is true:

- the algorithm is the learning settings default; see LEARNING-SETTINGS.md (§Defaults)
- it is the only algorithm left

Changing the learning settings default elsewhere is what makes a former default deletable again.

When no decks use the algorithm, confirm deletes it directly.

When one or more decks use it, the user must choose a successor algorithm.
Confirm reassigns every deck that pointed at the deleted algorithm to the successor, then deletes the algorithm.
The successor picker defaults to the first other algorithm.
If the successor is missing or invalid, delete fails and decks are left unchanged.

Deleting an algorithm does not delete decks or cards.
It does not delete the algorithm's history; see §History.

## History

Every algorithm keeps a history of its parameters.
The app does not display it.

A revision is recorded when:

- an algorithm is added, cloned, or created during first setup, with its starting parameters
- a save changes any parameter, with the parameters after the save
- optimized weights are applied, with the parameters after applying

Each revision holds the full set of parameters, not only the ones that changed.
It also records when it was recorded and who made the change.
That is the optimizer for applied optimized weights, and the user otherwise.

A save that changes only the title or notes records nothing.
A save that changes nothing records nothing.
A rejected save records nothing.

History survives deleting its algorithm.

## Mobile App

The mobile app lists its algorithms on a Presets tab, in the order they were added.

- Tapping a preset opens its editor, titled with the preset.
  Pulling the list down refreshes it.
- The editor edits the preset as §Editing Algorithms says, with Save and Discard below the form.
  It shows the timestamps, the title, the notes, and every parameter §Parameters lists.
- Retention is typed as a whole number rather than chosen on a slider.
  It and the maximum interval stay at or above zero as they are typed, and retention stays at or below 99.
  A number outside its range is rejected on save, as §Parameters says.
- Steps are added and removed as §Parameters says.
- Each rejected part shows its error under that part.
  A save the app refuses shows its error above Save, and the preset stays as it was.
- A change synced from another device shows in a part the user has not touched yet.
  The title, the notes, and the parameters together are each one part.
- A preset deleted on another device while its editor is open says it no longer exists.
- It has no optimization, and shows nothing in its place.
- "New preset" on the Presets tab adds a preset as §Adding Algorithms says.
  After the add, the new preset's editor opens in place of the form, instead of a link to it.
- Clone on the editor clones the preset as §Cloning Algorithms says, and then opens the clone's editor the same way.
- A rejected title shows its error under the title, and nothing is added.
  Going back from either form discards it without asking.
- The editor deletes the preset as §Deleting Algorithms says, asking first, and then returns to the Presets tab.
  While delete is unavailable, the editor says why.
- When decks use the preset, the editor counts them and offers the other presets as the successor, above Delete.
  The confirmation counts the decks that move.
- A failed delete shows its error on the editor, and the preset and its decks stay as they were.
