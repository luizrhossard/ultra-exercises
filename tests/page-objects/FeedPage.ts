import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class FeedPage extends BasePage {
  readonly feedContainer: Locator;
  readonly postCards: Locator;
  readonly createPostButton: Locator;
  readonly postContentInput: Locator;
  readonly postImageUpload: Locator;
  readonly publishButton: Locator;
  readonly likeButtons: Locator;
  readonly commentButtons: Locator;
  readonly shareButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.feedContainer = page.locator('[data-testid="feed-container"], .feed, main');
    this.postCards = page.locator('[data-testid="post-card"], .post-card, article');
    this.createPostButton = page.locator('[data-testid="create-post"], button:has-text("Criar Post"), button:has-text("Novo Post")');
    this.postContentInput = page.locator('[data-testid="post-content"], textarea[placeholder*="o que" i], textarea[name="content"]');
    this.postImageUpload = page.locator('[data-testid="post-image"], input[type="file"][accept*="image"]');
    this.publishButton = page.locator('[data-testid="publish-post"], button[type="submit"]:has-text("Publicar")');
    this.likeButtons = page.locator('[data-testid="like-button"], button:has-text("Curtir"), button[aria-label*="like" i]');
    this.commentButtons = page.locator('[data-testid="comment-button"], button:has-text("Comentar"), button[aria-label*="comment" i]');
    this.shareButtons = page.locator('[data-testid="share-button"], button:has-text("Compartilhar"), button[aria-label*="share" i]');
  }

  async createPost(content: string, imagePath?: string): Promise<void> {
    await this.clickAndWait(this.createPostButton);
    await this.waitForElement(this.postContentInput);
    await this.postContentInput.fill(content);
    if (imagePath) {
      await this.postImageUpload.setInputFiles(imagePath);
    }
    await this.clickAndWait(this.publishButton);
  }

  async likePost(index: number): Promise<void> {
    const likeButton = this.likeButtons.nth(index);
    await this.clickAndWait(likeButton);
  }

  async commentOnPost(index: number, comment: string): Promise<void> {
    const commentButton = this.commentButtons.nth(index);
    await this.clickAndWait(commentButton);
    const commentInput = this.page.locator('[data-testid="comment-input"], textarea[placeholder*="coment" i]');
    await this.waitForElement(commentInput);
    await commentInput.fill(comment);
    await commentInput.press('Enter');
  }

  async getPostCount(): Promise<number> {
    return await this.postCards.count();
  }

  async waitForFeedLoad(): Promise<void> {
    await this.waitForElement(this.feedContainer);
    await this.page.waitForLoadState('networkidle');
  }
}