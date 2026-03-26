import { test, expect, type Page } from "@playwright/test";

const CLIENT_URL = "http://localhost:3001";

/** Helper: open portal and set player name inline */
async function openPortal(page: Page, name: string) {
  await page.goto(CLIENT_URL);
  await page.getByTestId("name-input").fill(name);
  await page.getByTestId("name-input").press("Enter");
  await page.getByTestId("create-room-btn").waitFor({ timeout: 10_000 });
}

/** Helper: create a Bo3 room and wait for game page */
async function createBo3Room(page: Page) {
  await page.getByTestId("create-room-btn").click();
  await page.getByTestId("bo3-btn").click();
  await page.waitForURL("**/game**");
}

/** Helper: join the first available room */
async function joinFirstRoom(page: Page) {
  // Wait for the room list to populate
  await page.getByTestId("join-btn").first().waitFor({ timeout: 10_000 });
  await page.getByTestId("join-btn").first().click();
  await page.waitForURL("**/game**");
}

/** Helper: spectate the first available room */
async function spectateFirstRoom(page: Page) {
  await page.getByTestId("spectate-btn").first().waitFor({ timeout: 10_000 });
  await page.getByTestId("spectate-btn").first().click();
  await page.waitForURL("**/game**");
}

/** Helper: wait for choosing phase */
async function waitForChoosing(page: Page) {
  await page.getByTestId("phase-choosing").waitFor({ timeout: 15_000 });
}

/** Helper: make a choice */
async function choose(page: Page, choice: "rock" | "paper" | "scissors") {
  await page.getByTestId(`choice-${choice}`).click();
}

/** Helper: wait for match end */
async function waitForMatchEnd(page: Page) {
  await page.getByTestId("match-end").waitFor({ timeout: 30_000 });
}

test.describe("Best of 3 match with spectator", () => {
  test("two players complete a Bo3 match while a spectator watches", async ({ browser }) => {
    // Create 3 separate browser contexts (like 3 different users)
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const player1 = await ctx1.newPage();
    const player2 = await ctx2.newPage();
    const spectator = await ctx3.newPage();

    // --- Player 1 opens the portal and creates a room ---
    await openPortal(player1, "Alice");
    await createBo3Room(player1);

    // Player 1 should be waiting for opponent
    await player1.getByTestId("phase-waiting").waitFor({ timeout: 5_000 });

    // --- Player 2 opens the portal and joins the room ---
    await openPortal(player2, "Bob");
    await joinFirstRoom(player2);

    // Both players should now be in choosing phase
    await waitForChoosing(player1);
    await waitForChoosing(player2);

    // --- Spectator opens the portal and spectates ---
    await openPortal(spectator, "Charlie");
    await spectator.getByTestId("spectate-btn").first().waitFor({ timeout: 10_000 });
    await spectateFirstRoom(spectator);

    // Spectator should see the game (choosing phase, no choice buttons)
    await spectator.getByTestId("phase-choosing").waitFor({ timeout: 5_000 });
    await expect(spectator.getByTestId("choice-rock")).not.toBeVisible();

    // --- Round 1: Alice=Rock, Bob=Scissors → Alice wins ---
    await choose(player1, "rock");
    await choose(player2, "scissors");

    // Wait for reveal then back to choosing
    await waitForChoosing(player1);
    await waitForChoosing(player2);

    // --- Round 2: Alice=paper, Bob=scissors → Bob wins ---
    await choose(player1, "paper");
    await choose(player2, "scissors");

    await waitForChoosing(player1);
    await waitForChoosing(player2);

    // --- Round 3: Alice=rock, Bob=scissors → Alice wins match ---
    await choose(player1, "rock");
    await choose(player2, "scissors");

    // All three should see match end
    await waitForMatchEnd(player1);
    await waitForMatchEnd(player2);
    await waitForMatchEnd(spectator);

    // Verify results
    const p1Result = await player1.getByTestId("match-result").textContent();
    expect(p1Result).toBe("VICTORY!");

    const p2Result = await player2.getByTestId("match-result").textContent();
    expect(p2Result).toBe("DEFEAT");

    const finalScore = await player1.getByTestId("final-score").textContent();
    expect(finalScore).toContain("2");
    expect(finalScore).toContain("1");

    // Spectator also sees the result
    const spectatorResult = await spectator.getByTestId("match-result").textContent();
    expect(spectatorResult).toContain("WINS!");

    // Cleanup
    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });
});
