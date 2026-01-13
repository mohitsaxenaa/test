import { test, expect } from '@playwright/test';

// Helper: log + wait + execute
async function step(description: string, action: () => Promise<void>, page) {
  console.log(`➡️ STEP: ${description}`);
  await page.waitForTimeout(3000);
  await action();
}

test('Login using ONLY getByText("Login")', async ({ page }) => {

  await step('Navigate to login page', async () => {
    await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
  }, page);

  await step('Fill Username using placeholder', async () => {
    await page.getByPlaceholder('Username').fill('Admin');
  }, page);

  await step('Fill Password using placeholder', async () => {
    await page.getByPlaceholder('Password').fill('admin123');
  }, page);

  // ✅ Login using ONLY getByText('Login')
  console.log('➡️ STEP: Click Login button using getByText("Login")');
  await page.waitForTimeout(3000);

  await Promise.all([
    page.waitForURL('**/dashboard/index'),
    page.getByText('Login').nth(1).click() // 👈 critical fix
  ]);

  // ✅ Final assertion
  await expect(page).toHaveURL(
    'https://opensource-demo.orangehrmlive.com/web/index.php/dashboard/index'
  );
});
