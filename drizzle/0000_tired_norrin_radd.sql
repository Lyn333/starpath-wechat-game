CREATE TABLE `level_publications` (
	`id` varchar(32) NOT NULL,
	`levelId` varchar(32) NOT NULL,
	`versionId` varchar(32),
	`action` enum('publish','rollback','archive') NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `level_publications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `level_versions` (
	`id` varchar(32) NOT NULL,
	`levelId` varchar(32) NOT NULL,
	`versionNumber` int NOT NULL,
	`snapshot` json NOT NULL,
	`validation` json NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `level_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `levels` (
	`id` varchar(32) NOT NULL,
	`slug` varchar(96) NOT NULL,
	`title` varchar(160) NOT NULL,
	`gridSize` enum('6x6','8x8','10x10','12x12') NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL,
	`status` enum('draft','validated','published','archived') NOT NULL DEFAULT 'draft',
	`publishedVersionId` varchar(32),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `levels_id` PRIMARY KEY(`id`),
	CONSTRAINT `levels_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `level_publications` ADD CONSTRAINT `level_publications_levelId_levels_id_fk` FOREIGN KEY (`levelId`) REFERENCES `levels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `level_publications` ADD CONSTRAINT `level_publications_versionId_level_versions_id_fk` FOREIGN KEY (`versionId`) REFERENCES `level_versions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `level_publications` ADD CONSTRAINT `level_publications_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `level_versions` ADD CONSTRAINT `level_versions_levelId_levels_id_fk` FOREIGN KEY (`levelId`) REFERENCES `levels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `level_versions` ADD CONSTRAINT `level_versions_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `levels` ADD CONSTRAINT `levels_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `level_publications_level_idx` ON `level_publications` (`levelId`);--> statement-breakpoint
CREATE INDEX `level_versions_level_idx` ON `level_versions` (`levelId`);--> statement-breakpoint
CREATE INDEX `level_versions_level_number_idx` ON `level_versions` (`levelId`,`versionNumber`);--> statement-breakpoint
CREATE INDEX `levels_status_idx` ON `levels` (`status`);--> statement-breakpoint
CREATE INDEX `levels_size_difficulty_idx` ON `levels` (`gridSize`,`difficulty`);