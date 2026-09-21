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
