# Target assignment

The code starts with the first player and chooses a random other player in the rest of the list. This player is the current player's target. They are swapped with the next player in the array; then the code continues to the new next player to assign a target for it. When it reaches the end, it'll set the final player's target to the first player.

This results in a randomized chain. When a player is killed or kicked out, it'll patch up the chain by redirecting the player's assassin to the player's target.
