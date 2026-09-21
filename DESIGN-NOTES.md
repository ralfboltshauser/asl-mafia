# Interface audit and redesign

The game should answer three questions: what happened, what do I need to do, and what happens next? Brand expression comes from the ASL mark, restrained type, spacing, and contrast.

## Research applied

- [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — keep frequent actions visible; defer rules and occasional settings.
- [Nielsen Norman Group: visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) — arrange information in order of importance.
- [GOV.UK: buttons](https://design-system.service.gov.uk/components/button/) — use one primary action and labels that describe what happens.

These principles guide the interaction; the visual design retains the game's ASL identity.

## Problems removed

- Repeated room code, footer branding, and uppercase metadata distributed around the screen.
- Decorative role initials and player initial badges that repeated adjacent text.
- Multiple nested cards giving settings and instructions equal visual weight.
- Boxed player choices with excessive gaps, pushing actions down the phone.
- Role instructions competing with the revealed role's name.
- Repeated setup captions explaining controls that already have clear labels.
- Verbose action labels and a disabled Ready action before revealing the role.
- Competing CSS overrides accumulated across earlier changes.

## Screen priorities

| Screen | Primary information | Next action |
| --- | --- | --- |
| Entry | Mafia, player count, local play | Create or join |
| Creator lobby | One code/QR invite area, joined players, plain settings rows | Start game |
| Guest lobby | Waiting to start, joined players | Share invite if needed |
| Hidden role | Check your role privately | Reveal |
| Revealed role | Your actual role | Ready; role hides afterward |
| Night | Your available action or waiting status | Select and lock, if required |
| Morning | Named death or no death | Discuss, then start voting |
| Phone vote | Who to eliminate, privacy of the vote | Select and lock |
| In-person vote | Record the group's outcome | Select and confirm |
| Submitted vote | Vote submitted | Wait; inspect pending players if needed |
| Vote result | Named elimination or no elimination | Start next night |
| Game over | Winning team, revealed roles | Play again |

The QR remains beside the room code. Rule settings, readiness names, public ballots, self-voting, and private investigations remain available. No backend rules or stored room data changed.

## Verification

Visual inspection of entry, lobby, reveal, night, morning, vote, result, and game-over captures; mobile and desktop layouts. Real-browser gameplay checks use isolated rooms. Responsive fixtures separately check small and landscape screens, 44px controls, 16px inputs, and stable scroll position while polling. QR tests independently decode the image. Browser testing does not substitute for a physical-phone usability study.

## Help and accidental-action protection

Compact question-mark controls explain role settings, angel limits, voting modes, audio, and consequential actions. Help opens on tap, hover, or keyboard focus and dismisses with Escape or an outside tap. Explanations stay out of the main visual hierarchy.

A player can change or clear an unsubmitted target. The creator can undo the most recent settings edit in the lobby; a server-side comparison prevents undo from overwriting settings changed elsewhere. Readiness can be withdrawn until the last player is ready. Final submissions, skips, phase changes, removing a player, and replacing a saved seat require confirmation. Submitted choices remain final because they can reveal information or advance the game immediately. Native browser confirmation dialogs provide modal focus and platform accessibility.

Verification: 36 engine tests; Chromium and WebKit cancellation/help/undo flows; a complete five-player game; in-person voting cancellation and confirmation; audio controls; five mobile/landscape viewport fixtures. All gameplay tests use separate QA rooms.

## Loading, waiting, and recovery polish

Startup and saved-seat restoration now have an explicit loading screen instead of a blank page or a flash of the entry form. Requests show a spinner and an action-specific label, retain the current screen, and prevent competing submissions. The initial one-player lobby explains how friends join. Submitted choices and resting nights use quiet check/moon symbols; readiness has a segmented count indicator. Human waiting states have no looping loader or invented progress.

A failed saved-room connection retains the seat and offers Retry or Back to start. An interrupted active room stays visible and reconnects automatically with a manual retry option. Polls cannot overlap. Network errors preserve drafts and choices. Motion uses short heading entrances, button feedback, subtle popover fades, and transform-only spinners. Reduced-motion mode removes movement and looping animation. No backend rules or stored rooms changed.

Verified slow-request and failed-connection flows in Chromium and WebKit, including reduced motion and no entry-form flash while resuming. Full gameplay, confirmation/undo regressions, recovery scenarios, and five WebKit mobile/landscape viewport checks pass. Inspected mobile loading, first-player, submission, and offline screenshots. Physical devices were not tested.
