import { test, expect, type Page } from "@playwright/test";

const CLIENT_URL = "http://localhost:3001";

/** Helper: open portal and set player name inline */
async function openPortal(page: Page, name: string) {
  await page.goto(CLIENT_URL);
  await page.getByTestId("name-input").fill(name);
  await page.getByTestId("name-input").press("Enter");
  await page.getByTestId("create-room-btn").waitFor({ timeout: 10_000 });
}

async function createBo3Room(page: Page) {
  await page.getByTestId("create-room-btn").click();
  await page.getByTestId("bo3-btn").click();
  await page.waitForURL("**/game**");
}

async function waitForCurrentRoomId(page: Page) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const roomId = await page.evaluate(() => window.__RPS_ROOM_ID ?? null);
    if (roomId != null && roomId !== "") {
      return roomId;
    }
    await page.waitForTimeout(250);
  }

  throw new Error("Timed out waiting for current room id");
}

async function waitForRoomRowById(page: Page, roomId: string) {
  const refreshButton = page.getByRole("button", { name: "Refresh" }).first();

  for (let attempt = 0; attempt < 20; attempt++) {
    const roomRow = page.getByTestId(`room-${roomId}`);
    if (await roomRow.count() > 0) {
      await roomRow.waitFor({ timeout: 2_000 });
      return roomRow;
    }
    await refreshButton.click();
    await page.waitForTimeout(500);
  }

  throw new Error(`Timed out waiting for room row id "${roomId}"`);
}

async function joinRoomById(page: Page, roomId: string) {
  const roomRow = await waitForRoomRowById(page, roomId);
  await roomRow.locator('[data-testid="join-btn"]').click();
  await page.waitForURL("**/game**");
}

async function spectateRoomById(page: Page, roomId: string) {
  const roomRow = await waitForRoomRowById(page, roomId);
  await roomRow.locator('[data-testid="spectate-btn"]').click();
  await page.waitForURL("**/game**");
}

async function waitForChoosing(page: Page) {
  await page.getByTestId("phase-choosing").waitFor({ timeout: 20_000 });
}

async function choose(page: Page, choice: "rock" | "paper" | "scissors") {
  await page.getByTestId(`choice-${choice}`).click();
}

async function waitForMatchEnd(page: Page) {
  await page.getByTestId("match-end").waitFor({ timeout: 30_000 });
}

test.describe("Best of 3 match with spectator", () => {
  test("two players complete a Bo3 match while a spectator watches", async ({ browser }) => {
    const runId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const playerOneName = `Alice${runId}`.slice(0, 16);
    const playerTwoName = `Bob${runId}`.slice(0, 16);
    const spectatorName = `Spec${runId}`.slice(0, 16);

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const player1 = await ctx1.newPage();
    const player2 = await ctx2.newPage();
    const spectator = await ctx3.newPage();

    await openPortal(player1, playerOneName);
    await createBo3Room(player1);
    const roomId = await waitForCurrentRoomId(player1);

    await player1.getByTestId("phase-waiting").waitFor({ timeout: 5_000 });

    await openPortal(player2, playerTwoName);
    await joinRoomById(player2, roomId);

    await waitForChoosing(player1);
    await waitForChoosing(player2);

    await openPortal(spectator, spectatorName);
    await spectateRoomById(spectator, roomId);
    await spectator.getByTestId("phase-choosing").waitFor({ timeout: 5_000 });
    await expect(spectator.getByTestId("choice-rock")).not.toBeVisible();

    await choose(player1, "rock");
    await choose(player2, "scissors");
    await waitForChoosing(player1);
    await waitForChoosing(player2);

    await choose(player1, "paper");
    await choose(player2, "scissors");
    await waitForChoosing(player1);
    await waitForChoosing(player2);

    await choose(player1, "rock");
    await choose(player2, "scissors");

    await waitForMatchEnd(player1);
    await waitForMatchEnd(player2);
    await waitForMatchEnd(spectator);

    await expect(player1.getByTestId("match-result")).toHaveText("VICTORY!");
    await expect(player2.getByTestId("match-result")).toHaveText("DEFEAT");
    await expect(player1.getByTestId("final-score")).toContainText("2 - 1");
    await expect(spectator.getByTestId("match-result")).toContainText("WINS!");

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });
});
