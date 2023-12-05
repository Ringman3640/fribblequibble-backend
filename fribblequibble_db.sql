CREATE DATABASE IF NOT EXISTS fribblequibble_db;
USE fribblequibble_db;

CREATE TABLE IF NOT EXISTS tag (
	id INT AUTO_INCREMENT PRIMARY KEY,
	tag_name VARCHAR(50) NOT NULL,

	INDEX(tag_name),
    UNIQUE(tag_name)
);

CREATE TABLE IF NOT EXISTS topic (
	id INT AUTO_INCREMENT PRIMARY KEY,
	topic_name VARCHAR(50) NOT NULL,

	INDEX(topic_name),
    UNIQUE(topic_name)
);

CREATE TABLE IF NOT EXISTS access (
    access_level INT PRIMARY KEY,
	title VARCHAR(50) NOT NULL,

	INDEX(title)
);

INSERT INTO access
VALUES (1, 'User'), (2, 'Moderator'), (3, 'Admin'), (4, 'Developer');

CREATE TABLE IF NOT EXISTS discussion (
	id INT AUTO_INCREMENT PRIMARY KEY,
	title VARCHAR(100) NOT NULL,
	description VARCHAR(300),
    page_content TEXT,
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

CREATE TABLE IF NOT EXISTS choice (
    id INT PRIMARY KEY AUTO_INCREMENT,
    discussion_id INT NOT NULL,
    choice_name VARCHAR(50) NOT NULL,
    color CHAR(7),

    CONSTRAINT fk_choice_discussion_id FOREIGN KEY (discussion_id)
        REFERENCES discussion(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    INDEX(discussion_id),
    INDEX(choice_name),
    UNIQUE(discussion_id, choice_name)
);

CREATE TABLE IF NOT EXISTS discussion_tag (
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

CREATE TABLE IF NOT EXISTS `user` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    password_hash BINARY(60) NOT NULL,
    access_level INT NOT NULL DEFAULT 1,
    date_joined TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_access_level FOREIGN KEY (access_level)
        REFERENCES access(access_level)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    
    INDEX(username),
    INDEX(access_level)
);

CREATE TABLE IF NOT EXISTS user_choice (
    choice_id INT NOT NULL,
    user_id INT NOT NULL,
    discussion_id INT NOT NULL,

    CONSTRAINT pk_user_choice PRIMARY KEY (choice_id, user_id),
    CONSTRAINT fk_user_choice_choice_id FOREIGN KEY (choice_id)
        REFERENCES choice(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_user_choice_user_id FOREIGN KEY (user_id)
        REFERENCES user(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_user_choice_discussion_id FOREIGN KEY (discussion_id)
        REFERENCES discussion(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    UNIQUE(user_id, discussion_id)
);

CREATE TABLE IF NOT EXISTS quibble (
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

CREATE TABLE IF NOT EXISTS condemning_user (
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

/*
Changes:
	~ discussion:title VARCHAR(400) -> VARCHAR(100)
    + discussion:description
    + discussion:page_content
    + choice:id
    + choice:INDEX(discussion_id)
    - choice:pk_choice
    - choice:color NOT NULL
    + user:date_joined
    + user_choice:choice_id
    - user_choice:choice_name
    ~ user_choice:pk_user_choice (discussion_id, user_id) -> (choice_id, user_id)
    + user_choice:fk_user_choice_choice_id
    - user_choice:fk_user_choice_choice_name
    + user_choice:UNIQUE
*/
