DROP DATABASE IF EXISTS fribblequibble_db;
CREATE DATABASE fribblequibble_db;
USE fribblequibble_db;

CREATE TABLE tag (
	id INT AUTO_INCREMENT PRIMARY KEY,
	tag_name VARCHAR(50) NOT NULL,

	INDEX(tag_name),
    UNIQUE(tag_name)
);

CREATE TABLE topic (
	id INT AUTO_INCREMENT PRIMARY KEY,
	topic_name VARCHAR(50) NOT NULL,

	INDEX(topic_name),
    UNIQUE(topic_name)
);

CREATE TABLE access (
    access_level INT PRIMARY KEY,
	title VARCHAR(50) NOT NULL,

	INDEX(title)
);

INSERT INTO access
VALUES (1, 'User'), (2, 'Moderator'), (3, 'Admin'), (4, 'Developer');

CREATE TABLE discussion (
	id INT AUTO_INCREMENT PRIMARY KEY,
	title VARCHAR(300) NOT NULL,
	date_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    topic_id INT NOT NULL,

    CONSTRAINT fk_discussion_topic_id FOREIGN KEY (topic_id)
        REFERENCES topic(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX(title),
    INDEX(date_created),
    UNIQUE(title)
);

CREATE TABLE choice (
    discussion_id INT NOT NULL,
    choice_name VARCHAR(50) NOT NULL,
    color CHAR(7) NOT NULL,

    CONSTRAINT pk_choice PRIMARY KEY (discussion_id, choice_name),
    CONSTRAINT fk_choice_discussion_id FOREIGN KEY (discussion_id)
        REFERENCES discussion(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    INDEX(choice_name)
);

CREATE TABLE discussion_tag (
    discussion_id INT NOT NULL,
    tag_id INT NOT NULL,

    CONSTRAINT pk_discussion_tag PRIMARY KEY (discussion_id, tag_id),
    CONSTRAINT fk_discussion_tag_discussion_id FOREIGN KEY (discussion_id)
        REFERENCES discussion(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_discussion_tag_tag_id FOREIGN KEY (tag_id)
        REFERENCES tag(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE `user` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    password_hash BINARY(60) NOT NULL,
    access_level INT NOT NULL DEFAULT 1,

    CONSTRAINT fk_user_access_level FOREIGN KEY (access_level)
        REFERENCES access(access_level)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    
    INDEX(username),
    INDEX(access_level),
    UNIQUE(username)
);

CREATE TABLE user_choice (
    discussion_id INT NOT NULL,
    user_id INT NOT NULL,
    choice_name VARCHAR(50) NOT NULL,

    CONSTRAINT pk_user_choice PRIMARY KEY (discussion_id, user_id),
    CONSTRAINT fk_user_choice_discussion_id FOREIGN KEY (discussion_id)
        REFERENCES discussion(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_user_choice_user_id FOREIGN KEY (user_id)
        REFERENCES user(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_user_choice_choice_name FOREIGN KEY (choice_name)
        REFERENCES choice(choice_name)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE quibble (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    discussion_id INT NOT NULL,
    author_id INT,
    date_posted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content VARCHAR(400) DEFAULT "",

    CONSTRAINT fk_quibble_discussion_id FOREIGN KEY (discussion_id)
        REFERENCES discussion(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_quibble_author_id FOREIGN KEY (author_id)
        REFERENCES user(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    
    INDEX(discussion_id),
    INDEX(author_id),
    INDEX(date_posted)
);

CREATE TABLE condemning_user (
    user_id INT NOT NULL,
    quibble_id BIGINT NOT NULL,
    CONSTRAINT pk_condemning_user PRIMARY KEY (user_id, quibble_id),
    CONSTRAINT fk_condemning_user_user_id FOREIGN KEY (user_id)
        REFERENCES user(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_condemning_user_quibble_id FOREIGN KEY (quibble_id)
        REFERENCES quibble(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
