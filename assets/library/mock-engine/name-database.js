/**
 * ============================================================
 * PRODUCT  : Ultra Name Generator Pro
 * VERSION  : 3.1.0 (Offline Gold Master)
 * AUTHOR   : MD KAWSAR
 * LICENSE  : Commercial / CodeCanyon
 * FILE     : assets/library/mock-engine/name-database.js
 *
 * PURPOSE  : Offline name data store for the Ultra Name
 *            Generator Pro tool.  Exposes a single global
 *            object — window.nameDatabase — consumed by
 *            script.js via the generateLocalProfile() function.
 *
 * ARCHITECTURE
 * ────────────
 * This file must be loaded BEFORE script.js in the HTML.
 * It performs no DOM access and has no dependencies.
 *
 * POOL STRUCTURE (per key)
 * ────────────────────────
 * Each top-level key is a "pool key" referenced by the
 * regionalMap in script.js.  Every pool exposes four
 * properties consumed by generateLocalProfile():
 *
 *   maleFirst   {string[]}  — masculine given names
 *   femaleFirst {string[]}  — feminine given names
 *   lastNames   {string[]}  — family / surnames
 *   emailDomains{string[]}  — region-plausible email domains
 *                             (optional — script falls back to
 *                              generic domains if omitted, but
 *                              all pools here include it for
 *                              maximum regional authenticity)
 *
 * COVERAGE — 36 PRIMARY LINGUISTIC / CULTURAL POOLS
 * ──────────────────────────────────────────────────
 *   Shared pools  : sa (Arabic)  · es (Spanish) · fr (French)
 *                   ru (Slavic)  · pt (Portuguese) · en (English)
 *                   id (Indonesian/Malay) · cn (Chinese)
 *                   ir (Persian) · de (German) · nl (Dutch)
 *
 *   Own-key pools : us · gb · ca · au · mx · br
 *                   bd · in · pk · np · lk
 *                   jp · kr · vn · th · ph · id · kh · la · mm
 *                   tr · il
 *                   ng · ke · za · et
 *                   ru · pl · hu · ro · fi · se · no · dk
 *                   gr · it · al
 *
 * DATA QUALITY NOTES
 * ──────────────────
 * • All names are real, culturally appropriate, and commonly
 *   used within their respective regions.
 * • Romanised transliterations follow widely accepted Latin
 *   conventions (e.g., Hepburn for Japanese, Pinyin for Chinese).
 * • Arrays contain a minimum of 30 entries each; most contain
 *   40–50 entries to ensure statistical distribution quality
 *   across 500-profile batches.
 *
 * CHANGELOG
 * ─────────
 *  v3.1.0  — Initial offline database. Replaces all randomuser.me
 *             API calls.  36 pools covering all 195 countries via
 *             the regionalMap in script.js.
 * ============================================================
 */

/* ── Strict mode — prevents accidental global leakage ──── */
'use strict';

/* ════════════════════════════════════════════════════════════
 * POOL DEFINITIONS
 * ════════════════════════════════════════════════════════════ */
window.nameDatabase = Object.freeze({

    /* ══════════════════════════════════════════════════════
     * POOL: en — English / Generic Anglophone
     * COVERS: Ireland, Malta, Anglophone Caribbean,
     *         Pacific island nations, Anglophone sub-Saharan
     *         Africa (Botswana, Gambia, Ghana, Lesotho,
     *         Liberia, Malawi, Namibia, Sierra Leone, South
     *         Sudan, Swaziland, Uganda, Zambia, Zimbabwe),
     *         New Zealand, Fiji, Singapore (multilingual
     *         fallback), Guyana, Belize, Jamaica, Trinidad,
     *         and all remaining Anglophone territories.
     * ══════════════════════════════════════════════════════ */
    en: {
        maleFirst: [
            'James', 'Oliver', 'Noah', 'William', 'Benjamin', 'Elijah',
            'Lucas', 'Mason', 'Ethan', 'Alexander', 'Henry', 'Daniel',
            'Michael', 'Jackson', 'Sebastian', 'Aiden', 'Matthew',
            'Samuel', 'David', 'Joseph', 'Carter', 'Owen', 'Wyatt',
            'John', 'Jack', 'Luke', 'Jayden', 'Dylan', 'Grayson',
            'Levi', 'Isaac', 'Gabriel', 'Julian', 'Mateo', 'Anthony',
            'Jaxon', 'Lincoln', 'Joshua', 'Christopher', 'Andrew',
            'Theodore', 'Caleb', 'Ryan', 'Asher', 'Nathan', 'Thomas',
            'Leo', 'Isaiah', 'Charles', 'Josiah',
        ],
        femaleFirst: [
            'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Mia',
            'Charlotte', 'Amelia', 'Harper', 'Evelyn', 'Abigail',
            'Emily', 'Ella', 'Elizabeth', 'Camila', 'Luna', 'Sofia',
            'Avery', 'Mila', 'Aria', 'Scarlett', 'Penelope', 'Layla',
            'Chloe', 'Victoria', 'Madison', 'Eleanor', 'Grace',
            'Nora', 'Riley', 'Zoey', 'Hannah', 'Lily', 'Addison',
            'Aubrey', 'Ellie', 'Stella', 'Natalie', 'Zoe', 'Leah',
            'Hazel', 'Violet', 'Aurora', 'Savannah', 'Audrey',
            'Brooklyn', 'Bella', 'Claire', 'Skylar', 'Lucy',
        ],
        lastNames: [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia',
            'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson', 'Thomas',
            'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Moore',
            'Young', 'Allen', 'King', 'Wright', 'Scott', 'Hill',
            'Green', 'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell',
            'Roberts', 'Walker', 'Hall', 'Lewis', 'Robinson', 'Clark',
            'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Lee',
            'Gonzalez', 'Perez', 'Turner', 'Collins', 'Edwards',
            'Parker', 'Evans', 'Morris', 'Reed',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
            'icloud.com', 'protonmail.com', 'aol.com', 'live.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: us — United States
     * COVERS: United States
     * NOTE: Reflects the multicultural name landscape of
     *       the US, including Anglo, Hispanic, African-American,
     *       and Asian-American popular names.
     * ══════════════════════════════════════════════════════ */
    us: {
        maleFirst: [
            'Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'Aiden',
            'Lucas', 'Mason', 'Ethan', 'Logan', 'Jackson', 'Sebastian',
            'Mateo', 'Jack', 'Owen', 'Theodore', 'Levi', 'Henry',
            'Alexander', 'Wyatt', 'Michael', 'Daniel', 'Hudson', 'Caleb',
            'Matthew', 'Julian', 'Gabriel', 'Samuel', 'Benjamin', 'David',
            'Carter', 'Isaiah', 'Jayden', 'John', 'Joseph', 'Anthony',
            'Nolan', 'Cameron', 'Austin', 'Evan', 'Brayden', 'Tyler',
            'Colton', 'Jordan', 'Hunter', 'Connor', 'Xavier', 'Dominic',
            'Ian', 'Cooper',
        ],
        femaleFirst: [
            'Olivia', 'Emma', 'Charlotte', 'Amelia', 'Ava', 'Sophia',
            'Isabella', 'Mia', 'Evelyn', 'Harper', 'Luna', 'Camila',
            'Gianna', 'Elizabeth', 'Eleanor', 'Ella', 'Abigail', 'Sofia',
            'Avery', 'Scarlett', 'Emily', 'Aria', 'Penelope', 'Chloe',
            'Layla', 'Mila', 'Nora', 'Hazel', 'Madison', 'Ellie',
            'Lily', 'Nova', 'Isla', 'Grace', 'Violet', 'Aurora',
            'Riley', 'Zoey', 'Willow', 'Emilia', 'Stella', 'Zoe',
            'Victoria', 'Hannah', 'Addison', 'Leah', 'Lucy', 'Eliana',
            'Ivy', 'Everly',
        ],
        lastNames: [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia',
            'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez',
            'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
            'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez',
            'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez',
            'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
            'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
            'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera',
            'Campbell', 'Mitchell', 'Carter', 'Roberts',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com',
            'hotmail.com', 'aol.com', 'comcast.net', 'verizon.net',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: gb — United Kingdom
     * COVERS: United Kingdom
     * ══════════════════════════════════════════════════════ */
    gb: {
        maleFirst: [
            'Oliver', 'George', 'Noah', 'Arthur', 'Harry', 'Leo',
            'Muhammad', 'Oscar', 'Charlie', 'Jack', 'Freddie', 'Alfie',
            'Henry', 'Theo', 'Archie', 'Finley', 'Thomas', 'Ethan',
            'Luca', 'Max', 'William', 'Sebastian', 'James', 'Isaac',
            'Edward', 'Joshua', 'Samuel', 'Alexander', 'Reuben', 'Hugo',
            'Benjamin', 'Lucas', 'Elijah', 'Jude', 'Logan', 'Dylan',
            'Riley', 'Kai', 'Toby', 'Elliot', 'Nathan', 'Joseph',
            'Daniel', 'Adam', 'Jake', 'Ben', 'Cameron', 'Connor',
            'Evan', 'Callum',
        ],
        femaleFirst: [
            'Olivia', 'Amelia', 'Isla', 'Ava', 'Mia', 'Ivy', 'Lily',
            'Isabella', 'Rosie', 'Sophie', 'Sophia', 'Freya', 'Grace',
            'Poppy', 'Emily', 'Evie', 'Charlotte', 'Sienna', 'Alice',
            'Millie', 'Harper', 'Ella', 'Phoebe', 'Daisy', 'Harriet',
            'Florence', 'Jessica', 'Elsie', 'Chloe', 'Imogen', 'Ruby',
            'Molly', 'Lola', 'Esme', 'Arabella', 'Matilda', 'Ellie',
            'Violet', 'Eleanor', 'Willow', 'Hannah', 'Amelie', 'Eliza',
            'Clara', 'Niamh', 'Maisie', 'Lottie', 'Thea', 'Aurora', 'Zara',
        ],
        lastNames: [
            'Smith', 'Jones', 'Williams', 'Taylor', 'Brown', 'Davies',
            'Evans', 'Wilson', 'Thomas', 'Roberts', 'Johnson', 'Lewis',
            'Walker', 'Robinson', 'Wood', 'Thompson', 'White', 'Watson',
            'Jackson', 'Wright', 'Green', 'Harris', 'Cooper', 'King',
            'Lee', 'Martin', 'Clarke', 'James', 'Morgan', 'Hughes',
            'Edwards', 'Hill', 'Moore', 'Clark', 'Harrison', 'Scott',
            'Young', 'Morris', 'Hall', 'Ward', 'Turner', 'Carter',
            'Phillips', 'Mitchell', 'Patel', 'Adams', 'Campbell',
            'Anderson', 'Allen', 'Cook',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.co.uk', 'hotmail.co.uk', 'outlook.com',
            'btinternet.com', 'sky.com', 'virginmedia.com', 'protonmail.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: ca — Canada
     * COVERS: Canada
     * ══════════════════════════════════════════════════════ */
    ca: {
        maleFirst: [
            'Liam', 'Noah', 'Oliver', 'William', 'Benjamin', 'Lucas',
            'Jack', 'Logan', 'Ethan', 'James', 'Alexander', 'Jacob',
            'Henry', 'Aiden', 'Sebastian', 'Matthew', 'Jackson', 'Owen',
            'Samuel', 'Gabriel', 'Leo', 'Elijah', 'Ryan', 'Connor',
            'Nathan', 'Thomas', 'Isaac', 'Caleb', 'Daniel', 'Joshua',
            'David', 'Mason', 'Carter', 'Wyatt', 'Theodore', 'Julian',
            'Dylan', 'Luke', 'Adam', 'Evan', 'Michael', 'Levi',
            'Andrew', 'Tyler', 'Cameron', 'Hunter', 'Austin', 'Nolan',
            'Zachary', 'Max',
        ],
        femaleFirst: [
            'Olivia', 'Emma', 'Charlotte', 'Amelia', 'Ava', 'Sophia',
            'Isabella', 'Mia', 'Evelyn', 'Harper', 'Ella', 'Luna',
            'Aria', 'Lily', 'Grace', 'Chloe', 'Penelope', 'Eleanor',
            'Nora', 'Hazel', 'Scarlett', 'Riley', 'Zoey', 'Hannah',
            'Victoria', 'Stella', 'Violet', 'Aurora', 'Leah', 'Natalie',
            'Audrey', 'Claire', 'Isla', 'Ellie', 'Madison', 'Layla',
            'Zoe', 'Savannah', 'Brooklyn', 'Bella', 'Abigail', 'Emily',
            'Camila', 'Sofia', 'Avery', 'Mila', 'Nova', 'Lucy', 'Jade', 'Maya',
        ],
        lastNames: [
            'Smith', 'Brown', 'Tremblay', 'Martin', 'Roy', 'Wilson',
            'Gagnon', 'Johnson', 'Jones', 'Williams', 'Lavoie', 'Lee',
            'Anderson', 'Côté', 'Taylor', 'Bouchard', 'Thomas', 'Fortin',
            'Gauthier', 'Bergeron', 'Campbell', 'Leblanc', 'Stewart',
            'Morin', 'Thompson', 'Ouellet', 'Lévesque', 'Bélanger',
            'Desrosiers', 'Pelletier', 'Robinson', 'Miller', 'Davis',
            'Lefebvre', 'Murphy', 'Parent', 'Simard', 'Hall', 'Young',
            'Beaulieu', 'Scott', 'Turner', 'Rivera', 'Singh', 'Chan',
            'Kumar', 'Ali', 'McDonald', 'Graham', 'Reid',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.ca', 'hotmail.com', 'outlook.com',
            'rogers.com', 'bell.net', 'shaw.ca', 'telus.net',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: au — Australia
     * COVERS: Australia
     * ══════════════════════════════════════════════════════ */
    au: {
        maleFirst: [
            'Oliver', 'William', 'Jack', 'Noah', 'Thomas', 'James',
            'Liam', 'Lucas', 'Henry', 'Ethan', 'Charlie', 'Oscar',
            'Leo', 'Archie', 'George', 'Joshua', 'Lachlan', 'Alexander',
            'Benjamin', 'Harry', 'Max', 'Cooper', 'Sebastian', 'Mason',
            'Samuel', 'Kai', 'Hudson', 'Finn', 'Elijah', 'Angus',
            'Riley', 'Hugo', 'Isaac', 'Xavier', 'Jaxon', 'Theo',
            'Patrick', 'Connor', 'Flynn', 'Caleb', 'Hamish', 'Toby',
            'Ryan', 'Jasper', 'Bodhi', 'Zac', 'Dylan', 'Jackson',
            'Matthew', 'Cameron',
        ],
        femaleFirst: [
            'Olivia', 'Charlotte', 'Amelia', 'Ava', 'Mia', 'Isla',
            'Grace', 'Ella', 'Chloe', 'Lily', 'Sophie', 'Zoe',
            'Isabella', 'Emily', 'Ruby', 'Scarlett', 'Evie', 'Sienna',
            'Aria', 'Willow', 'Ellie', 'Matilda', 'Hazel', 'Violet',
            'Emma', 'Madison', 'Ivy', 'Poppy', 'Harper', 'Freya',
            'Phoebe', 'Aurora', 'Stella', 'Nora', 'Millie', 'Bella',
            'Daisy', 'Hannah', 'Evelyn', 'Layla', 'Clara', 'Alice',
            'Mackenzie', 'Lola', 'Molly', 'Zara', 'Harriet', 'Eliza',
            'Florence', 'Luna',
        ],
        lastNames: [
            'Smith', 'Jones', 'Williams', 'Brown', 'Wilson', 'Taylor',
            'Johnson', 'White', 'Martin', 'Anderson', 'Thompson',
            'Nguyen', 'Thomas', 'Walker', 'Harris', 'Robinson', 'Kelly',
            'King', 'Davis', 'Ryan', 'Mitchell', 'Lee', 'Murphy',
            'Patel', 'Collins', 'Jackson', 'Clarke', 'Evans', 'Hill',
            'Moore', 'Green', 'Young', 'Scott', 'Cook', 'Phillips',
            'Turner', 'Rogers', 'Morris', 'Cooper', 'Bailey', 'Clarke',
            'Singh', 'Chan', 'McDonald', 'Robertson', 'Campbell',
            'Stewart', 'Walsh', 'Lewis', 'Wood',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com.au', 'hotmail.com', 'outlook.com',
            'bigpond.com', 'iinet.net.au', 'optusnet.com.au', 'live.com.au',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: es — Spanish / Latin American
     * COVERS: Spain, Argentina, Bolivia, Chile, Colombia,
     *         Costa Rica, Cuba, Dominican Republic, Ecuador,
     *         El Salvador, Equatorial Guinea, Guatemala,
     *         Honduras, Mexico (shared), Nicaragua, Panama,
     *         Paraguay, Peru, Uruguay, Venezuela, Andorra.
     * ══════════════════════════════════════════════════════ */
    es: {
        maleFirst: [
            'Santiago', 'Mateo', 'Sebastián', 'Nicolás', 'Alejandro',
            'Diego', 'Samuel', 'Benjamin', 'Lucas', 'Martín', 'Daniel',
            'Emiliano', 'Miguel', 'Andrés', 'Joaquín', 'Elías', 'Pablo',
            'Ricardo', 'Francisco', 'Juan', 'Carlos', 'Luis', 'José',
            'Manuel', 'Antonio', 'Fernando', 'David', 'Eduardo', 'Rafael',
            'Jorge', 'Roberto', 'Héctor', 'Mario', 'Óscar', 'Adrián',
            'Iván', 'Cristian', 'Rodrigo', 'Felipe', 'Ignacio',
            'Álvaro', 'Hugo', 'Sergio', 'Rubén', 'Javier', 'Ángel',
            'Ramón', 'Víctor', 'Gabriel', 'Lorenzo',
        ],
        femaleFirst: [
            'Valentina', 'Sofía', 'Isabella', 'Camila', 'Valeria',
            'Luciana', 'Martina', 'Sara', 'Elena', 'María', 'Paula',
            'Daniela', 'Fernanda', 'Lucía', 'Gabriela', 'Ana',
            'Andrea', 'Laura', 'Claudia', 'Patricia', 'Carmen',
            'Isabel', 'Rosa', 'Natalia', 'Alejandra', 'Paola',
            'Verónica', 'Silvia', 'Mónica', 'Cristina', 'Beatriz',
            'Diana', 'Lorena', 'Adriana', 'Mariana', 'Renata',
            'Victoria', 'Mía', 'Emma', 'Ximena', 'Karla', 'Estefanía',
            'Sandra', 'Angela', 'Miriam', 'Pilar', 'Dolores',
            'Rebeca', 'Nuria', 'Esperanza',
        ],
        lastNames: [
            'García', 'Rodríguez', 'Martínez', 'Hernández', 'López',
            'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres',
            'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Morales',
            'Jiménez', 'Ruiz', 'Álvarez', 'Romero', 'Vargas',
            'Castillo', 'Ortiz', 'Mendoza', 'Gutiérrez', 'Chávez',
            'Ramos', 'Fernández', 'Cruz', 'Santos', 'Suárez',
            'Moreno', 'Aguilar', 'Delgado', 'Castro', 'Vega',
            'Medina', 'Herrera', 'Guerrero', 'Muñoz', 'Cabrera',
            'Espinoza', 'Fuentes', 'Lara', 'Navarro', 'Ortega',
            'Rojas', 'Silva', 'Ríos', 'Serrano',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.com', 'yahoo.es', 'outlook.es',
            'yahoo.com', 'live.com', 'protonmail.com', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: mx — Mexico
     * COVERS: Mexico
     * NOTE: Own pool for larger name variety; Mexico is the
     *       most populous Spanish-speaking nation on Earth.
     * ══════════════════════════════════════════════════════ */
    mx: {
        maleFirst: [
            'Santiago', 'Mateo', 'Sebastián', 'Emiliano', 'Diego',
            'Miguel', 'Alejandro', 'Daniel', 'Nicolás', 'Juan',
            'Carlos', 'Luis', 'José', 'Jesús', 'Francisco', 'Fernando',
            'Manuel', 'Ricardo', 'Eduardo', 'Roberto', 'Óscar', 'Mario',
            'Pablo', 'Andrés', 'Rodrigo', 'Adrián', 'Javier', 'Gerardo',
            'Rubén', 'Ernesto', 'Raúl', 'Enrique', 'Arturo', 'Armando',
            'Alfredo', 'Hugo', 'César', 'Héctor', 'Jorge', 'Rafael',
            'Salvador', 'Marco', 'Guillermo', 'Víctor', 'Antonio',
            'Iván', 'Felipe', 'Leonardo', 'Gabriel', 'Ángel',
        ],
        femaleFirst: [
            'Sofía', 'Valentina', 'Camila', 'Isabella', 'Valeria',
            'Mariana', 'Daniela', 'Fernanda', 'Lucía', 'Gabriela',
            'Ana', 'María', 'Karen', 'Paola', 'Adriana', 'Alejandra',
            'Mónica', 'Patricia', 'Laura', 'Claudia', 'Karla',
            'Estefanía', 'Natalia', 'Diana', 'Lorena', 'Verónica',
            'Sandra', 'Cristina', 'Brenda', 'Erika', 'Karina',
            'Vanessa', 'Marisol', 'Ximena', 'Norma', 'Yolanda',
            'Leticia', 'Beatriz', 'Graciela', 'Rosa', 'Elena',
            'Miriam', 'Alicia', 'Lupita', 'Andrea', 'Silvia',
            'Gloria', 'Estela', 'Rebeca', 'Sara',
        ],
        lastNames: [
            'García', 'Martínez', 'Hernández', 'López', 'González',
            'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores',
            'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Morales',
            'Jiménez', 'Ruiz', 'Álvarez', 'Romero', 'Vargas',
            'Castillo', 'Ortiz', 'Mendoza', 'Gutiérrez', 'Chávez',
            'Ramos', 'Cruz', 'Medina', 'Herrera', 'Aguilar',
            'Guerrero', 'Muñoz', 'Cabrera', 'Espinoza', 'Fuentes',
            'Lara', 'Navarro', 'Ortega', 'Rojas', 'Delgado',
            'Vega', 'Castro', 'Moreno', 'Suárez', 'Ríos',
            'Serrano', 'Luna', 'Miranda', 'Salazar', 'Carrillo',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.com', 'yahoo.com.mx', 'outlook.com',
            'live.com.mx', 'prodigy.net.mx', 'icloud.com', 'yahoo.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: br — Brazil
     * COVERS: Brazil
     * ══════════════════════════════════════════════════════ */
    br: {
        maleFirst: [
            'Miguel', 'Arthur', 'Heitor', 'Davi', 'Lorenzo', 'Gabriel',
            'Matheus', 'Lucas', 'Pedro', 'Guilherme', 'Enzo', 'Bernardo',
            'Samuel', 'João', 'Otávio', 'Rafael', 'Felipe', 'Eduardo',
            'Nicolas', 'Vitor', 'Gustavo', 'Diego', 'Bruno', 'Thiago',
            'Rodrigo', 'Henrique', 'Caio', 'Leonardo', 'Victor',
            'Alexandre', 'Fernando', 'Leandro', 'Marcos', 'Paulo',
            'Ricardo', 'Carlos', 'Roberto', 'André', 'Daniel',
            'Renato', 'Fábio', 'Márcio', 'Luiz', 'Julio', 'Sérgio',
            'Antônio', 'Marcelo', 'Douglas', 'Vinícius', 'Flávio',
        ],
        femaleFirst: [
            'Sofia', 'Alice', 'Laura', 'Isabella', 'Manuela', 'Júlia',
            'Heloísa', 'Luiza', 'Valentina', 'Giovanna', 'Maria',
            'Beatriz', 'Lara', 'Mariana', 'Gabriela', 'Ana', 'Letícia',
            'Rafaela', 'Fernanda', 'Camila', 'Amanda', 'Thais',
            'Bruna', 'Carolina', 'Natália', 'Aline', 'Patrícia',
            'Renata', 'Claudia', 'Vanessa', 'Priscila', 'Débora',
            'Viviane', 'Larissa', 'Jéssica', 'Juliana', 'Fabiana',
            'Milena', 'Adriana', 'Tatiana', 'Simone', 'Cristiane',
            'Bianca', 'Daniela', 'Luciana', 'Michelle', 'Roberta',
            'Sandra', 'Leila', 'Monica',
        ],
        lastNames: [
            'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues',
            'Ferreira', 'Alves', 'Pereira', 'Lima', 'Carvalho',
            'Melo', 'Ribeiro', 'Nascimento', 'Costa', 'Andrade',
            'Gomes', 'Barbosa', 'Martins', 'Araújo', 'Rocha',
            'Dias', 'Nunes', 'Correia', 'Cardoso', 'Castro',
            'Cunha', 'Mendes', 'Moura', 'Campos', 'Freitas',
            'Teixeira', 'Marques', 'Pinto', 'Batista', 'Luz',
            'Monteiro', 'Ramos', 'Lopes', 'Sousa', 'Fonseca',
            'Machado', 'Borges', 'Azevedo', 'Leite', 'Moreira',
            'Brito', 'Pires', 'Guimarães', 'Fernandes', 'Torres',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.com', 'yahoo.com.br', 'outlook.com',
            'uol.com.br', 'bol.com.br', 'terra.com.br', 'live.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: pt — Portuguese
     * COVERS: Portugal, Angola, Cabo Verde, Guinea-Bissau,
     *         Mozambique, São Tomé & Príncipe, East Timor.
     * ══════════════════════════════════════════════════════ */
    pt: {
        maleFirst: [
            'João', 'Diogo', 'Rodrigo', 'Tomás', 'Guilherme', 'Pedro',
            'Afonso', 'Francisco', 'Rui', 'André', 'Miguel', 'Tiago',
            'Gonçalo', 'Nuno', 'Luís', 'Carlos', 'Paulo', 'Ricardo',
            'Vasco', 'Henrique', 'Fernando', 'Eduardo', 'Sérgio',
            'Leandro', 'Vítor', 'Marco', 'Márcio', 'Bruno', 'Hugo',
            'Fábio', 'Alexandre', 'Rafael', 'Hélder', 'Filipe',
            'Manuel', 'Cristiano', 'Simão', 'Ivo', 'Renato', 'Jorge',
            'António', 'Daniel', 'David', 'Bernardo', 'Gabriel',
            'Samuel', 'Mateus', 'Dinis', 'Salvador', 'Lucas',
        ],
        femaleFirst: [
            'Maria', 'Beatriz', 'Inês', 'Mariana', 'Leonor', 'Sofia',
            'Ana', 'Mafalda', 'Francisca', 'Carolina', 'Marta',
            'Rita', 'Joana', 'Catarina', 'Filipa', 'Sónia', 'Tânia',
            'Andreia', 'Patrícia', 'Vanessa', 'Sara', 'Carla',
            'Sandra', 'Mónica', 'Liliana', 'Raquel', 'Daniela',
            'Diana', 'Vera', 'Cláudia', 'Susana', 'Cristina',
            'Natália', 'Laura', 'Alexandra', 'Luísa', 'Madalena',
            'Helena', 'Isabel', 'Teresa', 'Alice', 'Amélia',
            'Eduarda', 'Rosário', 'Cecília', 'Constança', 'Matilde',
            'Bruna', 'Cátia', 'Lara',
        ],
        lastNames: [
            'Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira',
            'Costa', 'Rodrigues', 'Martins', 'Jesus', 'Sousa',
            'Fernandes', 'Gonçalves', 'Gomes', 'Lopes', 'Marques',
            'Alves', 'Correia', 'Nunes', 'Mendes', 'Carvalho',
            'Ribeiro', 'Pinto', 'Teixeira', 'Soares', 'Monteiro',
            'Cardoso', 'Moreira', 'Coelho', 'Pires', 'Castro',
            'Almeida', 'Azevedo', 'Machado', 'Cunha', 'Figueiredo',
            'Simões', 'Fonseca', 'Dias', 'Maia', 'Antunes',
            'Rocha', 'Vieira', 'Freitas', 'Campos', 'Batista',
            'Borges', 'Ramos', 'Moura', 'Cruz', 'Araújo',
        ],
        emailDomains: [
            'gmail.com', 'sapo.pt', 'hotmail.com', 'outlook.pt',
            'yahoo.pt', 'live.pt', 'iol.pt', 'mail.pt',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: fr — French
     * COVERS: France, Belgium (dominant), Luxembourg, Monaco,
     *         Haiti, and all Francophone African nations.
     * ══════════════════════════════════════════════════════ */
    fr: {
        maleFirst: [
            'Gabriel', 'Raphaël', 'Léo', 'Louis', 'Lucas', 'Hugo',
            'Arthur', 'Jules', 'Théo', 'Tom', 'Noah', 'Adam',
            'Mathieu', 'Clément', 'Baptiste', 'Antoine', 'Nicolas',
            'Julien', 'Pierre', 'Alexandre', 'Thomas', 'Maxime',
            'Romain', 'Vincent', 'Quentin', 'Florian', 'Valentin',
            'Axel', 'Nathan', 'Simon', 'François', 'Guillaume',
            'Sébastien', 'Fabien', 'Jérémy', 'Benoît', 'Charles',
            'Étienne', 'Rémi', 'Adrien', 'Damien', 'Kevin',
            'Grégoire', 'Olivier', 'Xavier', 'Christophe', 'Pascal',
            'Laurent', 'Thierry', 'Patrice',
        ],
        femaleFirst: [
            'Emma', 'Jade', 'Louise', 'Chloé', 'Léa', 'Manon',
            'Inès', 'Camille', 'Clara', 'Sarah', 'Lena', 'Lucie',
            'Charlotte', 'Alice', 'Anaïs', 'Sophie', 'Julie',
            'Pauline', 'Clémence', 'Margot', 'Océane', 'Mathilde',
            'Amélie', 'Emilie', 'Marie', 'Aurélie', 'Laure',
            'Noémie', 'Justine', 'Céline', 'Stéphanie', 'Mélanie',
            'Virginie', 'Alexandra', 'Caroline', 'Isabelle',
            'Sandrine', 'Nathalie', 'Christine', 'Sylvie', 'Anne',
            'Valérie', 'Florence', 'Dominique', 'Brigitte',
            'Françoise', 'Martine', 'Monique', 'Hélène', 'Jacqueline',
        ],
        lastNames: [
            'Martin', 'Bernard', 'Thomas', 'Petit', 'Robert',
            'Richard', 'Durand', 'Dubois', 'Moreau', 'Laurent',
            'Simon', 'Michel', 'Lefebvre', 'Leroy', 'Roux',
            'David', 'Bertrand', 'Morel', 'Fournier', 'Girard',
            'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau',
            'Vincent', 'Muller', 'Lefevre', 'Faure', 'André',
            'Mercier', 'Blanc', 'Guérin', 'Boyer', 'Garnier',
            'Chevalier', 'François', 'Legrand', 'Gauthier',
            'Garcia', 'Perrin', 'Robin', 'Clément', 'Morin',
            'Nicolas', 'Henry', 'Roussel', 'Mathieu', 'Gautier', 'Masson',
        ],
        emailDomains: [
            'gmail.com', 'laposte.net', 'orange.fr', 'free.fr',
            'hotmail.fr', 'yahoo.fr', 'sfr.fr', 'wanadoo.fr',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: de — German
     * COVERS: Germany, Austria, Switzerland (dominant).
     * ══════════════════════════════════════════════════════ */
    de: {
        maleFirst: [
            'Noah', 'Leon', 'Paul', 'Ben', 'Elias', 'Jonas', 'Felix',
            'Luca', 'Julian', 'Maximilian', 'Niklas', 'Jan', 'Lukas',
            'David', 'Tim', 'Finn', 'Simon', 'Erik', 'Philipp',
            'Tobias', 'Sebastian', 'Christian', 'Michael', 'Stefan',
            'Andreas', 'Thomas', 'Daniel', 'Patrick', 'Johannes',
            'Christoph', 'Markus', 'Martin', 'Klaus', 'Hans',
            'Peter', 'Wolfgang', 'Ralf', 'Jürgen', 'Karl', 'Otto',
            'Friedrich', 'Gerhard', 'Horst', 'Walter', 'Dieter',
            'Werner', 'Heinz', 'Bernd', 'Uwe', 'Axel',
        ],
        femaleFirst: [
            'Emma', 'Mia', 'Hannah', 'Sofia', 'Emilia', 'Lena',
            'Anna', 'Leonie', 'Lina', 'Laura', 'Lea', 'Johanna',
            'Marie', 'Nele', 'Amelie', 'Clara', 'Charlotte', 'Luisa',
            'Katharina', 'Sarah', 'Julia', 'Lisa', 'Sabrina',
            'Melanie', 'Nina', 'Andrea', 'Claudia', 'Petra',
            'Silke', 'Monika', 'Susanne', 'Angela', 'Karin',
            'Birgit', 'Christine', 'Ursula', 'Elisabeth', 'Helga',
            'Renate', 'Ingrid', 'Brigitte', 'Ute', 'Gisela',
            'Martina', 'Stefanie', 'Anja', 'Nicole', 'Sandra',
            'Simone', 'Tanja',
        ],
        lastNames: [
            'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber',
            'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
            'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein',
            'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann',
            'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange',
            'Schmitt', 'Werner', 'Krause', 'Meier', 'Lehmann',
            'Schmitz', 'Herrmann', 'Walter', 'König', 'Mayer',
            'Huber', 'Kaiser', 'Fuchs', 'Peters', 'Lang',
            'Scholz', 'Möller', 'Weiß', 'Jung', 'Hahn',
            'Schubert', 'Vogel', 'Friedrich', 'Keller', 'Günther',
        ],
        emailDomains: [
            'gmail.com', 'web.de', 'gmx.de', 't-online.de',
            'hotmail.de', 'yahoo.de', 'freenet.de', 'outlook.de',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: nl — Dutch
     * COVERS: Netherlands, Suriname.
     * ══════════════════════════════════════════════════════ */
    nl: {
        maleFirst: [
            'Liam', 'Noah', 'Oliver', 'Daan', 'Sem', 'Milan',
            'Luuk', 'Finn', 'Lars', 'Bram', 'Thijs', 'Sander',
            'Niels', 'Joris', 'Wouter', 'Ruben', 'Tom', 'Thomas',
            'Jurgen', 'Arjen', 'Pieter', 'Jan', 'Hans', 'Kees',
            'Piet', 'Henk', 'Willem', 'Maarten', 'Jeroen', 'Bart',
            'Rob', 'Tim', 'Rick', 'Dennis', 'Kevin', 'Stefan',
            'Peter', 'Mark', 'Erik', 'David', 'Bas', 'Joren',
            'Stijn', 'Jens', 'Olivier', 'Victor', 'Simon',
            'Nick', 'Wesley', 'Roel',
        ],
        femaleFirst: [
            'Emma', 'Olivia', 'Femke', 'Lisa', 'Anouk', 'Saar',
            'Nora', 'Julia', 'Anna', 'Lotte', 'Amber', 'Floor',
            'Nathalie', 'Silke', 'Esmee', 'Laura', 'Manon',
            'Roos', 'Iris', 'Fleur', 'Charlotte', 'Lena',
            'Stefanie', 'Marieke', 'Sandra', 'Karen', 'Denise',
            'Monique', 'Petra', 'Miriam', 'Anita', 'Hanneke',
            'Inge', 'Liesbeth', 'Rianne', 'Wendy', 'Chantal',
            'Nicole', 'Suzanne', 'Linda', 'Ingrid', 'Els',
            'Marjon', 'Wilma', 'Marianne', 'Corine', 'Carolien',
            'Joke', 'Tineke', 'Marga',
        ],
        lastNames: [
            'de Jong', 'Jansen', 'de Vries', 'van den Berg',
            'van Dijk', 'Bakker', 'Janssen', 'Visser', 'Smit',
            'Meijer', 'de Boer', 'Mulder', 'de Groot', 'Bos',
            'Vos', 'Peters', 'Hendriks', 'van Leeuwen', 'Dekker',
            'Brouwer', 'de Wit', 'Dijkstra', 'Smits', 'de Graaf',
            'van der Berg', 'van Vliet', 'Kok', 'Jacobs', 'Laan',
            'Kramer', 'Hoekstra', 'Peeters', 'Martens', 'Willems',
            'Claes', 'van Dam', 'Kuiper', 'Schouten', 'Prins',
            'Huisman', 'Maassen', 'van Beek', 'de Leeuw', 'Pool',
            'Hermans', 'Wouters', 'Vermeer', 'van den Brink',
            'van der Laan', 'Snel',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.nl', 'outlook.com', 'ziggo.nl',
            'xs4all.nl', 'kpn.nl', 'live.nl', 'yahoo.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: ru — Slavic / Russian
     * COVERS: Russia, Belarus, Bulgaria, Bosnia, Croatia,
     *         Czech Republic, Estonia, Kazakhstan, Kyrgyzstan,
     *         Latvia, Lithuania, Moldova, Montenegro, North
     *         Macedonia, Serbia, Slovakia, Slovenia, Turkmenistan,
     *         Ukraine, Uzbekistan, Mongolia (fallback),
     *         Armenia (fallback), Georgia (fallback).
     * ══════════════════════════════════════════════════════ */
    ru: {
        maleFirst: [
            'Alexander', 'Mikhail', 'Ivan', 'Dmitri', 'Sergei',
            'Andrei', 'Vladimir', 'Nikolai', 'Pavel', 'Alexei',
            'Artyom', 'Maxim', 'Yuri', 'Viktor', 'Oleg',
            'Stanislav', 'Konstantin', 'Evgeni', 'Timur', 'Ruslan',
            'Igor', 'Denis', 'Roman', 'Vitaly', 'Ilya',
            'Grigory', 'Boris', 'Anatoly', 'Valery', 'Vadim',
            'Leonid', 'Pyotr', 'Fyodor', 'Kirill', 'Georgy',
            'Nikita', 'Yakov', 'Daniil', 'Semyon', 'Matvei',
            'Danil', 'Yaroslav', 'Stepan', 'Gennady', 'Vitaliy',
            'Taras', 'Bogdan', 'Oleksiy', 'Mykola', 'Vasyl',
        ],
        femaleFirst: [
            'Anna', 'Natalia', 'Elena', 'Olga', 'Irina',
            'Maria', 'Tatiana', 'Svetlana', 'Oksana', 'Ekaterina',
            'Natalya', 'Ludmila', 'Galina', 'Valentina', 'Nina',
            'Vera', 'Sofia', 'Alexandra', 'Anastasia', 'Yulia',
            'Nadia', 'Daria', 'Polina', 'Yana', 'Alina',
            'Veronika', 'Kristina', 'Larisa', 'Tamara', 'Zhanna',
            'Lyudmila', 'Inna', 'Alla', 'Oksana', 'Maryna',
            'Viktoriya', 'Halyna', 'Iryna', 'Oksana', 'Nadiia',
            'Kateryna', 'Larysa', 'Olena', 'Tetiana', 'Liudmyla',
            'Nataliia', 'Mariia', 'Dariya', 'Svitlana', 'Ivanna',
        ],
        lastNames: [
            'Ivanov', 'Smirnov', 'Kuznetsov', 'Popov', 'Sokolov',
            'Lebedev', 'Kozlov', 'Novikov', 'Morozov', 'Petrov',
            'Volkov', 'Solovyov', 'Vasilyev', 'Zaitsev', 'Pavlov',
            'Semyonov', 'Golubev', 'Vinogradov', 'Bogdanov', 'Vorobyov',
            'Fyodorov', 'Mikhailov', 'Belyaev', 'Tarasov', 'Belov',
            'Komarov', 'Orlov', 'Kiselev', 'Makarov', 'Andreyev',
            'Kovalev', 'Ilyín', 'Gusev', 'Tikhomirov', 'Nikitin',
            'Kononov', 'Shevchenko', 'Tkachenko', 'Kovalenko', 'Bondarenko',
            'Melnyk', 'Kravchenko', 'Olijnyk', 'Petrenko', 'Savchenko',
            'Boyko', 'Marchenko', 'Morozova', 'Kovalchuk', 'Lysenko',
        ],
        emailDomains: [
            'gmail.com', 'mail.ru', 'yandex.ru', 'rambler.ru',
            'bk.ru', 'list.ru', 'inbox.ru', 'hotmail.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: pl — Polish
     * COVERS: Poland
     * ══════════════════════════════════════════════════════ */
    pl: {
        maleFirst: [
            'Jakub', 'Jan', 'Szymon', 'Aleksander', 'Michał', 'Mateusz',
            'Bartosz', 'Paweł', 'Piotr', 'Marek', 'Łukasz', 'Kamil',
            'Grzegorz', 'Tomasz', 'Marcin', 'Krzysztof', 'Robert',
            'Dariusz', 'Mariusz', 'Rafał', 'Artur', 'Dawid', 'Andrzej',
            'Karol', 'Radosław', 'Leszek', 'Wojciech', 'Tadeusz',
            'Mirosław', 'Józef', 'Stanisław', 'Waldemar', 'Ryszard',
            'Zbigniew', 'Bogdan', 'Henryk', 'Edmund', 'Janusz',
            'Zygmunt', 'Wiesław', 'Czesław', 'Mieczysław', 'Zdzisław',
            'Benedykt', 'Konrad', 'Sebastian', 'Adrian', 'Damian',
            'Dominik', 'Filip',
        ],
        femaleFirst: [
            'Zuzanna', 'Julia', 'Zofia', 'Maja', 'Aleksandra',
            'Natalia', 'Wiktoria', 'Oliwia', 'Amelia', 'Martyna',
            'Karolina', 'Magdalena', 'Anna', 'Agnieszka', 'Katarzyna',
            'Monika', 'Paulina', 'Joanna', 'Barbara', 'Izabela',
            'Małgorzata', 'Dorota', 'Ewelina', 'Sylwia', 'Ewa',
            'Renata', 'Beata', 'Elżbieta', 'Danuta', 'Grażyna',
            'Irena', 'Teresa', 'Zofia', 'Halina', 'Wanda',
            'Jadwiga', 'Stanisława', 'Genowefa', 'Krystyna', 'Urszula',
            'Bożena', 'Alicja', 'Hanna', 'Lidia', 'Jolanta',
            'Wiesława', 'Celina', 'Czesława', 'Marta', 'Klaudia',
        ],
        lastNames: [
            'Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kowalczyk',
            'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański',
            'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski',
            'Mazur', 'Kwiatkowski', 'Krawczyk', 'Piotrowski',
            'Grabowski', 'Nowakowski', 'Pawłowski', 'Michalski',
            'Nowicki', 'Adamczyk', 'Dudek', 'Zając', 'Wieczorek',
            'Jabłoński', 'Król', 'Majewski', 'Olszewski',
            'Jaworski', 'Wróbel', 'Malinowski', 'Pawlak', 'Witkowski',
            'Walczak', 'Stępień', 'Górski', 'Rutkowski', 'Michalak',
            'Sikora', 'Ostrowski', 'Baran', 'Duda', 'Szewczyk',
            'Tomaszewski', 'Pietrzak', 'Marciniak', 'Wróblewski', 'Zalewski',
        ],
        emailDomains: [
            'gmail.com', 'wp.pl', 'onet.pl', 'interia.pl',
            'o2.pl', 'poczta.fm', 'hotmail.com', 'outlook.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: hu — Hungarian
     * COVERS: Hungary
     * ══════════════════════════════════════════════════════ */
    hu: {
        maleFirst: [
            'Bence', 'Máté', 'Dávid', 'Balázs', 'Péter', 'Gábor',
            'Ádám', 'Zoltán', 'László', 'Tamás', 'András', 'Attila',
            'Ákos', 'Csaba', 'Tibor', 'Roland', 'Norbert', 'Szabolcs',
            'Krisztián', 'Zsolt', 'Dániel', 'Márton', 'Levente',
            'Bendegúz', 'Elemér', 'Botond', 'Hunor', 'Gergő',
            'Milán', 'Dominik', 'Kristóf', 'Barnabás', 'Nándor',
            'Árpád', 'Imre', 'Béla', 'István', 'Sándor', 'János',
            'Ferenc', 'Lajos', 'Miklós', 'Pál', 'György', 'Gyula',
            'Károly', 'Kálmán', 'Dezső', 'Aladár', 'Ernő',
        ],
        femaleFirst: [
            'Réka', 'Anna', 'Petra', 'Zsófia', 'Dorina', 'Eszter',
            'Viktória', 'Éva', 'Katalin', 'Erzsébet', 'Mária',
            'Ágnes', 'Klára', 'Veronika', 'Judit', 'Monika',
            'Andrea', 'Nikolett', 'Lilla', 'Tünde', 'Anikó',
            'Ildikó', 'Krisztina', 'Zsuzsanna', 'Erika', 'Anita',
            'Orsolya', 'Nóra', 'Renáta', 'Beáta', 'Csilla',
            'Emőke', 'Hajnalka', 'Gabriella', 'Brigitta', 'Edina',
            'Gyöngyi', 'Hanna', 'Kinga', 'Piroska', 'Borbála',
            'Julianna', 'Margit', 'Irén', 'Terézia', 'Rozália',
            'Marta', 'Szilvia', 'Timea', 'Elvira',
        ],
        lastNames: [
            'Nagy', 'Kovács', 'Tóth', 'Szabó', 'Horváth', 'Varga',
            'Kiss', 'Molnár', 'Németh', 'Farkas', 'Balogh', 'Papp',
            'Takács', 'Juhász', 'Lakatos', 'Mészáros', 'Oláh',
            'Simon', 'Rácz', 'Fekete', 'Szász', 'Fehér', 'Balázs',
            'Gál', 'Boros', 'Pintér', 'Szücs', 'Váradi', 'Máté',
            'Vincze', 'Fodor', 'Csizmadia', 'Hegedűs', 'Lukács',
            'Bíró', 'Kerekes', 'Szokolai', 'Novák', 'Fülöp',
            'Barta', 'Csiky', 'Hajdu', 'Karácsonyi', 'Pénzes',
            'Sipos', 'Soós', 'Erdős', 'Nemes', 'Bartha',
        ],
        emailDomains: [
            'gmail.com', 'freemail.hu', 'citromail.hu', 'hotmail.com',
            'outlook.com', 'yahoo.com', 't-online.hu', 'vipmail.hu',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: ro — Romanian
     * COVERS: Romania
     * ══════════════════════════════════════════════════════ */
    ro: {
        maleFirst: [
            'Alexandru', 'Andrei', 'Mihai', 'Ionuț', 'Bogdan',
            'Vlad', 'Cristian', 'Gabriel', 'Darius', 'Sebastian',
            'Radu', 'Florin', 'Marius', 'Adrian', 'Cosmin',
            'Sergiu', 'Cătălin', 'Laurențiu', 'Claudiu', 'Valentin',
            'Tudor', 'Sorin', 'Lucian', 'Ciprian', 'Dorin',
            'Călin', 'Cezar', 'Ovidiu', 'Remus', 'Traian',
            'Dumitru', 'Gheorghe', 'Ion', 'Constantin', 'Vasile',
            'Nicolae', 'Ilie', 'Petre', 'Aurel', 'Grigore',
            'Cornel', 'Liviu', 'Dorel', 'Emil', 'Viorel',
            'Mircea', 'Tiberiu', 'Octavian', 'Silviu', 'Eugen',
        ],
        femaleFirst: [
            'Maria', 'Elena', 'Ioana', 'Ana', 'Andreea', 'Alexandra',
            'Cristina', 'Mihaela', 'Roxana', 'Ioana', 'Alina',
            'Laura', 'Diana', 'Gabriela', 'Daniela', 'Monica',
            'Raluca', 'Simona', 'Irina', 'Bianca', 'Nicoleta',
            'Florentina', 'Marilena', 'Luminița', 'Valentina',
            'Camelia', 'Dorina', 'Lavinia', 'Silvia', 'Oana',
            'Mădălina', 'Claudia', 'Adriana', 'Loredana', 'Lidia',
            'Viorica', 'Ionela', 'Mariana', 'Rodica', 'Geanina',
            'Georgeta', 'Anca', 'Liliana', 'Sorina', 'Mioara',
            'Niculina', 'Iuliana', 'Veronica', 'Doina', 'Carmen',
        ],
        lastNames: [
            'Pop', 'Ionescu', 'Popa', 'Radu', 'Dumitru', 'Stan',
            'Stoica', 'Gheorghe', 'Constantin', 'Marin', 'Tudor',
            'Moldovan', 'Vlad', 'Mihai', 'Nistor', 'Ilea',
            'Mureșan', 'Bogdan', 'Costea', 'Lungu', 'Oprea',
            'Florescu', 'Dima', 'Ene', 'Balan', 'Toma', 'Luca',
            'Dumitrescu', 'Andrei', 'Matei', 'Roman', 'Rusu',
            'Avram', 'Stancu', 'Sandu', 'Ardelean', 'Blaga',
            'Ciobanu', 'Dănilă', 'Grigore', 'Lazăr', 'Mocanu',
            'Neacșu', 'Olaru', 'Pavel', 'Rotaru', 'Stroe',
            'Tănase', 'Vasile', 'Zaharia', 'Ungureanu',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.ro', 'hotmail.com', 'outlook.com',
            'yahoo.com', 'live.com', 'protonmail.com', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: it — Italian
     * COVERS: Italy, San Marino, Vatican.
     * ══════════════════════════════════════════════════════ */
    it: {
        maleFirst: [
            'Leonardo', 'Francesco', 'Lorenzo', 'Alessandro', 'Andrea',
            'Mattia', 'Gabriele', 'Riccardo', 'Tommaso', 'Edoardo',
            'Federico', 'Davide', 'Luca', 'Marco', 'Matteo',
            'Simone', 'Stefano', 'Alberto', 'Antonio', 'Giovanni',
            'Claudio', 'Massimo', 'Enrico', 'Nicola', 'Giorgio',
            'Luigi', 'Mario', 'Roberto', 'Fabio', 'Paolo',
            'Angelo', 'Vincenzo', 'Giuseppe', 'Carlo', 'Aldo',
            'Gianni', 'Bruno', 'Silvio', 'Dario', 'Emanuele',
            'Filippo', 'Giacomo', 'Gioele', 'Ignazio', 'Nico',
            'Ottavio', 'Sergio', 'Tiziano', 'Ugo', 'Valentino',
        ],
        femaleFirst: [
            'Sofia', 'Giulia', 'Martina', 'Sara', 'Laura',
            'Alessia', 'Chiara', 'Federica', 'Silvia', 'Elena',
            'Valentina', 'Elisa', 'Anna', 'Francesca', 'Paola',
            'Roberta', 'Claudia', 'Serena', 'Monica', 'Barbara',
            'Daniela', 'Cinzia', 'Rossana', 'Sabrina', 'Giovanna',
            'Maria', 'Lucia', 'Michela', 'Cristina', 'Angela',
            'Patrizia', 'Simona', 'Lorenza', 'Annalisa', 'Beatrice',
            'Carla', 'Donatella', 'Emma', 'Fiamma', 'Ginevra',
            'Irene', 'Lisa', 'Nadia', 'Ornella', 'Palma',
            'Rosa', 'Stefania', 'Teresa', 'Virna', 'Zara',
        ],
        lastNames: [
            'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi',
            'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
            'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa',
            'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti',
            'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi',
            'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone',
            'Longo', 'Gentile', 'Martinelli', 'Vitali', 'Cattaneo',
            'Montanari', 'Grasso', 'Serra', 'Pellegrino', 'Palumbo',
            'Silvestri', 'De Angelis', 'Ferretti', 'Riva', 'Neri',
            'Giuliani', 'Ferri', 'Benedetti', 'Orlando', 'Poli',
        ],
        emailDomains: [
            'gmail.com', 'libero.it', 'hotmail.it', 'yahoo.it',
            'outlook.it', 'tiscali.it', 'virgilio.it', 'alice.it',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: gr — Greek
     * COVERS: Greece, Cyprus.
     * ══════════════════════════════════════════════════════ */
    gr: {
        maleFirst: [
            'Nikos', 'Giorgos', 'Kostas', 'Dimitris', 'Christos',
            'Vasilis', 'Thanasis', 'Panagiotis', 'Michalis', 'Giannis',
            'Alexandros', 'Stavros', 'Petros', 'Andreas', 'Spyros',
            'Manolis', 'Tasos', 'Lefteris', 'Nektarios', 'Stratos',
            'Antonis', 'Vangelis', 'Makis', 'Panos', 'Takis',
            'Yiannis', 'Fotis', 'Ilias', 'Kosmas', 'Leonidas',
            'Markos', 'Nikolaos', 'Odysseas', 'Paris', 'Sotiris',
            'Thanos', 'Athanasios', 'Kyriakos', 'Elias', 'Demetrios',
            'Evangelos', 'Konstantinos', 'Gregorios', 'Ioannis',
            'Stefanos', 'Theodoris', 'Giorgios', 'Apostolos', 'Nikiforos', 'Pavlos',
        ],
        femaleFirst: [
            'Maria', 'Elena', 'Katerina', 'Georgia', 'Ioanna',
            'Eleni', 'Sofia', 'Dimitra', 'Christina', 'Anna',
            'Despina', 'Vasiliki', 'Alexandra', 'Aikaterini',
            'Panagiota', 'Stavroula', 'Angeliki', 'Vasso', 'Irini',
            'Foteini', 'Marika', 'Niki', 'Nadia', 'Anastasia',
            'Evgenia', 'Efthymia', 'Kyriaki', 'Magda', 'Melina',
            'Paraskevi', 'Theodora', 'Zoe', 'Charitini', 'Dafni',
            'Evangelia', 'Ifigenia', 'Konstantina', 'Lena', 'Nefeli',
            'Olympia', 'Penelope', 'Rhodopi', 'Smaro', 'Thekla',
            'Athina', 'Calliope', 'Chrysa', 'Demetra', 'Elpida', 'Evangeline',
        ],
        lastNames: [
            'Papadopoulos', 'Papadimitriou', 'Nikolaou', 'Georgiou',
            'Christodoulou', 'Vasiliou', 'Makris', 'Dimitriou',
            'Konstantinou', 'Stefanidis', 'Antoniou', 'Theodorou',
            'Alexiou', 'Economou', 'Petrou', 'Andreou', 'Stavros',
            'Michalakis', 'Yiannakis', 'Karamanlis', 'Papageorgiou',
            'Papadakis', 'Katsaros', 'Kalogeropoulos', 'Mantzoros',
            'Mavrogiannis', 'Pagonis', 'Sotiriou', 'Tsalikis',
            'Xenopoulos', 'Dimakopoulos', 'Efthymiou', 'Fragakis',
            'Haritos', 'Ioannidis', 'Kalogerakis', 'Lambrakis',
            'Moschopoulos', 'Ntovas', 'Oikonomou', 'Polychronakis',
            'Raptis', 'Sakellaropoulos', 'Tzanakis', 'Varelas',
            'Zachariou', 'Zervos', 'Giannakis', 'Komninos', 'Liakos',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.gr', 'hotmail.com', 'outlook.com',
            'otenet.gr', 'forthnet.gr', 'in.gr', 'live.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: al — Albanian
     * COVERS: Albania, Kosovo.
     * ══════════════════════════════════════════════════════ */
    al: {
        maleFirst: [
            'Artan', 'Besnik', 'Blerim', 'Drin', 'Enis', 'Erion',
            'Faton', 'Genc', 'Ilir', 'Kujtim', 'Liridon', 'Mediat',
            'Naim', 'Orhan', 'Parim', 'Qëndrim', 'Rinor', 'Shpend',
            'Taulant', 'Urim', 'Valmir', 'Xhevdet', 'Ylber', 'Zenel',
            'Agim', 'Bajram', 'Çlirim', 'Driton', 'Fadil', 'Gentian',
            'Hamdi', 'Ismet', 'Jeton', 'Kastriot', 'Labinot',
            'Mentor', 'Nexhip', 'Perparim', 'Ramadan', 'Sokol',
            'Tonin', 'Valdrin', 'Vilson', 'Zamir', 'Arber',
            'Burim', 'Dritan', 'Ervis', 'Flori', 'Granit',
        ],
        femaleFirst: [
            'Albana', 'Besa', 'Donika', 'Eda', 'Fjolla', 'Gresa',
            'Hana', 'Ilda', 'Jeta', 'Kaltrina', 'Labinota', 'Merita',
            'Njomza', 'Orgesa', 'Prenda', 'Rudina', 'Shqipe',
            'Teuta', 'Uta', 'Vjosa', 'Xhensila', 'Yllka', 'Zana',
            'Afërdita', 'Blerta', 'Dafina', 'Edona', 'Fatmira',
            'Gëzime', 'Hatixhe', 'Igballe', 'Jehona', 'Kujtesa',
            'Linda', 'Mrika', 'Nexhmije', 'Pranvera', 'Remzije',
            'Selvete', 'Tringa', 'Valbone', 'Violeta', 'Ylbere',
            'Albulena', 'Besarta', 'Cana', 'Dyljana', 'Elsa',
            'Florieta',
        ],
        lastNames: [
            'Hoxha', 'Shehu', 'Mustafa', 'Krasniqi', 'Berisha',
            'Gashi', 'Halili', 'Ibrahimi', 'Juniku', 'Kelmendi',
            'Lulaj', 'Mula', 'Nushi', 'Osmani', 'Pllana',
            'Rexhepi', 'Salihu', 'Thaçi', 'Ukëhaxhaj', 'Veseli',
            'Xhaferi', 'Ymeri', 'Zeqiri', 'Arifaj', 'Bajrami',
            'Çeku', 'Doci', 'Emini', 'Fili', 'Gojani',
            'Hasani', 'Isai', 'Jashari', 'Kastrati', 'Lleshi',
            'Mehmeti', 'Nimani', 'Olluri', 'Prenaj', 'Rugova',
            'Selimi', 'Toplana', 'Ujkani', 'Vokshi', 'Xhema',
            'Ymaj', 'Zeka', 'Agushi', 'Bunjaku', 'Dërmaku',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'live.com', 'icloud.com', 'protonmail.com', 'mail.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: se — Swedish
     * COVERS: Sweden
     * ══════════════════════════════════════════════════════ */
    se: {
        maleFirst: [
            'Lucas', 'Liam', 'William', 'Oscar', 'Noah', 'Hugo',
            'Oliver', 'Elias', 'Alexander', 'Axel', 'Emil', 'Viktor',
            'Isak', 'Adam', 'Filip', 'Erik', 'Carl', 'Anton',
            'Arvid', 'Nils', 'Pontus', 'Rasmus', 'Simon', 'Tobias',
            'Johan', 'Marcus', 'Johannes', 'Andreas', 'Björn', 'Lars',
            'Mikael', 'Stefan', 'Peter', 'Sven', 'Magnus', 'Henrik',
            'Anders', 'Per', 'Claes', 'Göran', 'Bengt', 'Thomas',
            'Jonas', 'Rickard', 'Fredrik', 'Mattias', 'Niklas',
            'Patrik', 'Martin', 'Joakim',
        ],
        femaleFirst: [
            'Alice', 'Maja', 'Elsa', 'Linnea', 'Astrid', 'Ebba',
            'Wilma', 'Ella', 'Stella', 'Julia', 'Emma', 'Alva',
            'Klara', 'Matilda', 'Lova', 'Elin', 'Saga', 'Emilia',
            'Nora', 'Amanda', 'Sara', 'Hanna', 'Maria', 'Anna',
            'Katarina', 'Eva', 'Kristina', 'Ingrid', 'Britta',
            'Helena', 'Sofia', 'Lena', 'Annika', 'Camilla', 'Karin',
            'Cecilia', 'Johanna', 'Malin', 'Elisabeth', 'Linda',
            'Åsa', 'Mia', 'Susanne', 'Ulrika', 'Jenny', 'Petra',
            'Marie', 'Charlotte', 'Carolina', 'Birgitta',
        ],
        lastNames: [
            'Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson',
            'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson',
            'Pettersson', 'Jonsson', 'Jansson', 'Hansson', 'Bengtsson',
            'Jönsson', 'Lindqvist', 'Magnusson', 'Lindgren',
            'Axelsson', 'Bergström', 'Lindberg', 'Björk', 'Holm',
            'Berg', 'Ek', 'Lind', 'Nyström', 'Sandberg', 'Åberg',
            'Dahl', 'Engström', 'Fransson', 'Hedlund', 'Isaksson',
            'Kjellgren', 'Lundqvist', 'Martinsson', 'Nordin',
            'Ohlsson', 'Pålsson', 'Rydberg', 'Sjöberg', 'Thorén',
            'Viklund', 'Wallin', 'Öberg', 'Ström', 'Söderberg', 'Blom',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.com', 'live.se', 'outlook.com',
            'spray.se', 'comhem.se', 'tele2.se', 'bredband.net',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: no — Norwegian
     * COVERS: Norway
     * ══════════════════════════════════════════════════════ */
    no: {
        maleFirst: [
            'Oliver', 'Noah', 'William', 'Lucas', 'Liam', 'Elias',
            'Emil', 'Oscar', 'Isak', 'Filip', 'Jakob', 'Tobias',
            'Sebastian', 'Mathias', 'Henrik', 'Kristian', 'Magnus',
            'Martin', 'Lars', 'Erik', 'Anders', 'Per', 'Tor',
            'Eirik', 'Håkon', 'Bjørn', 'Knut', 'Svein', 'Geir',
            'Rune', 'Steinar', 'Trond', 'Frode', 'Stian', 'Vegard',
            'Øyvind', 'Terje', 'Morten', 'Thomas', 'Jonatan',
            'Daniel', 'Ola', 'Petter', 'Roar', 'Sindre', 'Sigurd',
            'Gunnar', 'Halvard', 'Leif', 'Arild',
        ],
        femaleFirst: [
            'Emma', 'Nora', 'Sofia', 'Olivia', 'Ingrid', 'Maja',
            'Astrid', 'Frida', 'Emilia', 'Ida', 'Amalie', 'Sara',
            'Linnea', 'Thea', 'Silje', 'Hanne', 'Kristine',
            'Marte', 'Anne', 'Marit', 'Kari', 'Helene', 'Randi',
            'Bente', 'Siri', 'Trine', 'Lisbeth', 'Tone', 'Heidi',
            'Elisabeth', 'Berit', 'Gro', 'Vigdis', 'Aud', 'Turid',
            'Toril', 'Solveig', 'Kirsten', 'Inger', 'Laila',
            'Wenche', 'Nina', 'Line', 'Stine', 'Maria', 'Hilde',
            'Camilla', 'Marianne', 'Monica', 'Anita',
        ],
        lastNames: [
            'Hansen', 'Johansen', 'Olsen', 'Larsen', 'Andersen',
            'Pedersen', 'Nilsen', 'Kristiansen', 'Jensen', 'Karlsen',
            'Johnsen', 'Pettersen', 'Eriksen', 'Berg', 'Haugen',
            'Hagen', 'Johannessen', 'Andreassen', 'Jacobsen',
            'Dahl', 'Jørgensen', 'Halvorsen', 'Henriksen',
            'Christensen', 'Lund', 'Sørensen', 'Holm', 'Lie',
            'Moen', 'Nygaard', 'Strand', 'Bakke', 'Eide', 'Krog',
            'Lindqvist', 'Madsen', 'Næss', 'Ottesen', 'Paulsen',
            'Rasmussen', 'Svendsen', 'Thorsen', 'Vik', 'Wold',
            'Aas', 'Bøe', 'Dybvik', 'Fjeld', 'Gram', 'Iversen',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.com', 'online.no', 'outlook.com',
            'start.no', 'broadpark.no', 'live.no', 'yahoo.no',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: dk — Danish / Nordic
     * COVERS: Denmark, Iceland.
     * ══════════════════════════════════════════════════════ */
    dk: {
        maleFirst: [
            'Oliver', 'Noah', 'William', 'Lucas', 'Magnus',
            'Oscar', 'Liam', 'Emil', 'Frederik', 'Mikkel',
            'Rasmus', 'Christian', 'Lars', 'Henrik', 'Thomas',
            'Søren', 'Andreas', 'Mads', 'Nikolaj', 'Kasper',
            'Martin', 'Peter', 'Jesper', 'Jens', 'Klaus',
            'Niels', 'Torben', 'Flemming', 'Bent', 'Mogens',
            'Bjarne', 'Arne', 'Finn', 'Svend', 'Preben',
            'Knud', 'Kai', 'Axel', 'Viggo', 'Poul',
            'Claus', 'Jakob', 'Kristian', 'Tobias', 'Simon',
            'Daniel', 'Jonas', 'Marcus', 'Victor', 'Benjamin',
        ],
        femaleFirst: [
            'Emma', 'Ida', 'Olivia', 'Sofie', 'Laura', 'Sara',
            'Clara', 'Astrid', 'Freja', 'Maja', 'Nora', 'Eline',
            'Anna', 'Cecilie', 'Maria', 'Julie', 'Katrine',
            'Malene', 'Line', 'Pernille', 'Stine', 'Hanne',
            'Lone', 'Birgitte', 'Kirsten', 'Inger', 'Else',
            'Gitte', 'Marianne', 'Dorthe', 'Tine', 'Vibeke',
            'Mette', 'Lene', 'Pia', 'Susanne', 'Charlotte',
            'Karen', 'Lotte', 'Anni', 'Betty', 'Ulla',
            'Bodil', 'Britta', 'Ruth', 'Randi', 'Solveig',
            'Grethe', 'Jytte', 'Edith',
        ],
        lastNames: [
            'Nielsen', 'Jensen', 'Hansen', 'Pedersen', 'Andersen',
            'Christensen', 'Larsen', 'Sørensen', 'Rasmussen',
            'Jørgensen', 'Petersen', 'Madsen', 'Kristensen',
            'Olsen', 'Thomsen', 'Christiansen', 'Poulsen',
            'Johansen', 'Møller', 'Mortensen', 'Lund', 'Dahl',
            'Holm', 'Berg', 'Nygaard', 'Bom', 'Clausen',
            'Davidsen', 'Eriksen', 'Friis', 'Gram', 'Holst',
            'Iversen', 'Kjær', 'Kjeldsen', 'Lindqvist', 'Lund',
            'Mikkelsen', 'Nissen', 'Pilgaard', 'Schwartz',
            'Thorsen', 'Vestergaard', 'Winther', 'Aaberg',
            'Bach', 'Carstensen', 'Damsgaard', 'Frandsen',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.dk', 'outlook.dk', 'yahoo.dk',
            'live.dk', 'msn.com', 'jubii.dk', 'post.dk',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: fi — Finnish
     * COVERS: Finland
     * ══════════════════════════════════════════════════════ */
    fi: {
        maleFirst: [
            'Elias', 'Oliver', 'Eino', 'Onni', 'Ilmari', 'Väinö',
            'Mikael', 'Aleksi', 'Juhani', 'Valtteri', 'Matias',
            'Lauri', 'Joonas', 'Petteri', 'Kristian', 'Juha',
            'Mikko', 'Timo', 'Antti', 'Pekka', 'Jari', 'Matti',
            'Heikki', 'Kari', 'Seppo', 'Jorma', 'Erkki', 'Paavo',
            'Tapio', 'Pentti', 'Olavi', 'Esko', 'Pertti', 'Reino',
            'Veikko', 'Aarre', 'Arvo', 'Urho', 'Kalevi', 'Rauno',
            'Simo', 'Ahti', 'Hannu', 'Veli', 'Markku', 'Osmo',
            'Risto', 'Tarmo', 'Teppo', 'Ville',
        ],
        femaleFirst: [
            'Emma', 'Sofia', 'Aino', 'Helmi', 'Siiri', 'Liisa',
            'Maria', 'Tuulikki', 'Aino', 'Maija', 'Mirjam',
            'Kaisa', 'Sanna', 'Hanna', 'Tiina', 'Päivi', 'Eija',
            'Riitta', 'Leena', 'Minna', 'Niina', 'Anu', 'Tuija',
            'Pirjo', 'Seija', 'Merja', 'Anja', 'Kaisa', 'Maarit',
            'Anneli', 'Tuula', 'Ritva', 'Marjatta', 'Liisa',
            'Aila', 'Raija', 'Kirsi', 'Taina', 'Marja', 'Pirjo',
            'Sinikka', 'Helena', 'Eila', 'Maija', 'Hilkka',
            'Irma', 'Sylvi', 'Tyyne', 'Aino', 'Elsa',
        ],
        lastNames: [
            'Mäkinen', 'Korhonen', 'Virtanen', 'Mäkelä', 'Laine',
            'Heikkinen', 'Hämäläinen', 'Leinonen', 'Lehtinen',
            'Lehtonen', 'Saarinen', 'Järvinen', 'Savolainen',
            'Nieminen', 'Koskinen', 'Turunen', 'Niskanen',
            'Väisänen', 'Kinnunen', 'Rajala', 'Niemi', 'Aho',
            'Huhtala', 'Peltonen', 'Halonen', 'Salonen',
            'Hyvarinen', 'Kokkonen', 'Luoto', 'Martikainen',
            'Nyman', 'Ojala', 'Peltola', 'Rantanen', 'Sipilä',
            'Tikkanen', 'Uusitalo', 'Vanhanen', 'Westerlund',
            'Ylinen', 'Aaltonen', 'Bergman', 'Lindqvist',
            'Laaksonen', 'Toivonen', 'Kärki', 'Mattila',
            'Paananen', 'Suominen', 'Pitkänen',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.fi', 'outlook.com', 'yahoo.fi',
            'luukku.com', 'welho.com', 'dnainternet.fi', 'live.fi',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: sa — Arabic
     * COVERS: Saudi Arabia, UAE, Kuwait, Qatar, Oman, Bahrain,
     *         Iraq, Jordan, Lebanon, Syria, Yemen, Egypt, Libya,
     *         Algeria, Tunisia, Morocco, Sudan, Mauritania,
     *         Djibouti, Somalia, Comoros, Maldives.
     * ══════════════════════════════════════════════════════ */
    sa: {
        maleFirst: [
            'Mohammed', 'Ahmed', 'Abdullah', 'Omar', 'Ali', 'Ibrahim',
            'Hassan', 'Hussein', 'Khalid', 'Sami', 'Tariq', 'Faisal',
            'Yousef', 'Nasser', 'Hamza', 'Waleed', 'Bilal', 'Kareem',
            'Saad', 'Zaid', 'Adel', 'Majid', 'Rashed', 'Fahad',
            'Salman', 'Nawaf', 'Haitham', 'Mustafa', 'Amr',
            'Ayman', 'Khaled', 'Mazen', 'Osama', 'Ramzi',
            'Suleiman', 'Tarek', 'Wissam', 'Yasser', 'Ziad',
            'Akram', 'Basel', 'Diaa', 'Eyad', 'Ghassan',
            'Ihab', 'Jamal', 'Kamal', 'Loay', 'Nidal', 'Obaid',
        ],
        femaleFirst: [
            'Fatima', 'Aisha', 'Mariam', 'Sara', 'Nour', 'Reem',
            'Haya', 'Salma', 'Layla', 'Maryam', 'Yasmin',
            'Zainab', 'Hessa', 'Noura', 'Safa', 'Dina',
            'Hana', 'Rana', 'Lina', 'Mona', 'Samira', 'Nada',
            'Amira', 'Rima', 'Abeer', 'Wafa', 'Dalal',
            'Ghada', 'Hind', 'Ibtisam', 'Jumana', 'Khulood',
            'Lubna', 'Manar', 'Nihal', 'Ola', 'Pari',
            'Rania', 'Sahar', 'Tahani', 'Ula', 'Widad',
            'Yara', 'Zana', 'Aseel', 'Buthayna', 'Cyrine',
            'Duaa', 'Enas',
        ],
        lastNames: [
            'Al-Rashid', 'Al-Farsi', 'Al-Zahrani', 'Al-Qahtani',
            'Al-Ghamdi', 'Al-Harbi', 'Al-Otaibi', 'Al-Shehri',
            'Al-Dosari', 'Al-Mutairi', 'Al-Hamdan', 'Al-Sabah',
            'Al-Thani', 'Al-Maktoum', 'Al-Nahyan', 'Khalil',
            'Hassan', 'Ibrahim', 'Mahmoud', 'Mohamed', 'Salem',
            'Ahmed', 'Ali', 'Suleiman', 'Karimi', 'Nasser',
            'Al-Amin', 'Al-Bakr', 'Al-Jabri', 'Al-Khaldi',
            'Al-Mansouri', 'Al-Najjar', 'Al-Omari', 'Al-Qassem',
            'Al-Saeed', 'Al-Tamimi', 'Al-Yami', 'Abdulaziz',
            'Abdulrahman', 'Abou-Zeid', 'Bou-Saada', 'El-Sayed',
            'Fadel', 'Haddad', 'Idris', 'Jaber', 'Khoury',
            'Mansour', 'Nasr', 'Qureshi',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com',
            'live.com', 'icloud.com', 'yahoo.co.id', 'mail.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: tr — Turkish
     * COVERS: Turkey, Azerbaijan.
     * ══════════════════════════════════════════════════════ */
    tr: {
        maleFirst: [
            'Mehmet', 'Mustafa', 'Ahmet', 'Ali', 'Hasan', 'Emre',
            'Murat', 'İbrahim', 'Hüseyin', 'Ömer', 'Yusuf', 'Burak',
            'Erkan', 'Serkan', 'Kemal', 'Orhan', 'Berk', 'Selim',
            'Umut', 'Barış', 'Deniz', 'Arda', 'Kaan', 'Fatih',
            'Oğuz', 'Tolga', 'Volkan', 'Furkan', 'Yasin', 'Caner',
            'Doğukan', 'Efe', 'Gökhan', 'Haluk', 'İlhan', 'Kadir',
            'Levent', 'Nuri', 'Osman', 'Polat', 'Recep', 'Suat',
            'Taner', 'Uğur', 'Vural', 'Yiğit', 'Zafer', 'Alper',
            'Cenk', 'Erhan',
        ],
        femaleFirst: [
            'Zeynep', 'Ayşe', 'Fatma', 'Emine', 'Hatice', 'Elif',
            'Selin', 'Derya', 'Pınar', 'Esra', 'Meryem', 'Sibel',
            'Dilek', 'Melek', 'Yasemin', 'Gül', 'Ceren', 'Büşra',
            'Merve', 'Ebru', 'Neslihan', 'Özge', 'Tuğba', 'Sevgi',
            'Betül', 'Çiğdem', 'Gülden', 'Hülya', 'İlknur',
            'Jale', 'Kezban', 'Lale', 'Müge', 'Nuray', 'Özlem',
            'Perihan', 'Rana', 'Selma', 'Şule', 'Tülay', 'Ufuk',
            'Vildan', 'Yeliz', 'Zeliha', 'Aylin', 'Bahar',
            'Cansu', 'Dilara', 'Ece', 'Filiz',
        ],
        lastNames: [
            'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Doğan',
            'Kılıç', 'Arslan', 'Coşkun', 'Aydın', 'Öztürk', 'Yıldız',
            'Yıldırım', 'Çetin', 'Polat', 'Koç', 'Aksoy', 'Kurt',
            'Erdoğan', 'Güneş', 'Güler', 'Korkmaz', 'Acar', 'Akay',
            'Balcı', 'Ceylan', 'Dağ', 'Erdem', 'Filiz', 'Gündüz',
            'Işık', 'Karaca', 'Özçelik', 'Sönmez', 'Taş',
            'Uçar', 'Vural', 'Yiğit', 'Zorlu', 'Bayrak',
            'Çınar', 'Duman', 'Ekinci', 'Gür', 'Koca', 'Nar',
            'Pala', 'Sari', 'Terzi', 'Tunç',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.com', 'yahoo.com', 'mynet.com',
            'outlook.com', 'turk.net', 'superonline.com', 'ttmail.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: ir — Persian
     * COVERS: Iran, Afghanistan, Tajikistan.
     * ══════════════════════════════════════════════════════ */
    ir: {
        maleFirst: [
            'Ali', 'Mohammad', 'Hossein', 'Reza', 'Hassan',
            'Ahmad', 'Hamid', 'Mehdi', 'Amir', 'Javad',
            'Saeed', 'Kamran', 'Shahram', 'Dariush', 'Farhad',
            'Bahram', 'Cyrus', 'Dara', 'Ehsan', 'Farshad',
            'Gholamreza', 'Hooman', 'Iman', 'Jafar', 'Karim',
            'Laleh', 'Masoud', 'Navid', 'Omid', 'Payam',
            'Rahim', 'Shahab', 'Taha', 'Vahid', 'Younes',
            'Behruz', 'Esmaeil', 'Fardin', 'Golnaz', 'Iraj',
            'Kiarash', 'Mani', 'Nima', 'Pirouz', 'Rostam',
            'Siamak', 'Sourin', 'Arash', 'Kasra', 'Maziyar',
        ],
        femaleFirst: [
            'Fateme', 'Zahra', 'Maryam', 'Sara', 'Narges',
            'Leila', 'Shirin', 'Parisa', 'Nasrin', 'Neda',
            'Bahar', 'Donya', 'Elham', 'Farzaneh', 'Golnar',
            'Hengameh', 'Iran', 'Jila', 'Kimia', 'Laleh',
            'Mahsa', 'Niloofar', 'Pantea', 'Roxana', 'Sahar',
            'Taraneh', 'Venus', 'Yasaman', 'Ziba', 'Arezoo',
            'Bita', 'Cheshmeh', 'Delaram', 'Eda', 'Fereshteh',
            'Golriz', 'Hoda', 'Ilnaz', 'Jaleh', 'Katayoun',
            'Ladan', 'Mahboubeh', 'Naghmeh', 'Omidreza', 'Pegah',
            'Roya', 'Setareh', 'Touba', 'Aram', 'Nazanin',
        ],
        lastNames: [
            'Hosseini', 'Ahmadi', 'Mohammadi', 'Karimi', 'Mousavi',
            'Rezaei', 'Moradi', 'Rahmani', 'Sadeghi', 'Nazari',
            'Amiri', 'Bagheri', 'Javadi', 'Kazemi', 'Majidi',
            'Naseri', 'Omidvar', 'Pasha', 'Qasemi', 'Shirazi',
            'Tehrani', 'Abbasi', 'Beheshti', 'Darvishi', 'Ebrahimi',
            'Fallah', 'Ghorbani', 'Hashemi', 'Jafari', 'Khodaei',
            'Lotfi', 'Mansouri', 'Najafi', 'Pakzad', 'Rostami',
            'Shafiei', 'Talebi', 'Yazdi', 'Zand', 'Afshari',
            'Bordbar', 'Dehghani', 'Esmaeili', 'Fard', 'Gorji',
            'Hakimi', 'Isfahani', 'Karimian', 'Lajevardi', 'Mehr',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'chmail.ir', 'iran.ir', 'parsmail.com', 'live.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: il — Hebrew / Israeli
     * COVERS: Israel
     * ══════════════════════════════════════════════════════ */
    il: {
        maleFirst: [
            'David', 'Moshe', 'Yosef', 'Daniel', 'Noam', 'Ido',
            'Eitan', 'Ariel', 'Lior', 'Avi', 'Ron', 'Itai',
            'Yonatan', 'Nir', 'Guy', 'Ran', 'Shimon', 'Shmuel',
            'Eliad', 'Boaz', 'Barak', 'Ehud', 'Gal', 'Haim',
            'Ilan', 'Jonathan', 'Kobi', 'Levi', 'Meir', 'Nadav',
            'Ohad', 'Pini', 'Roi', 'Shaul', 'Tzahi', 'Uri',
            'Vered', 'Yaniv', 'Ziv', 'Assaf', 'Doron', 'Erez',
            'Gilad', 'Ittamar', 'Koresh', 'Matan', 'Ofer', 'Paz',
            'Shai', 'Tal',
        ],
        femaleFirst: [
            'Tamar', 'Shira', 'Noa', 'Maya', 'Adi', 'Gal',
            'Yael', 'Rivka', 'Rachel', 'Michal', 'Orly', 'Dana',
            'Ella', 'Hadar', 'Inbar', 'Keren', 'Liron', 'Mor',
            'Nili', 'Ofra', 'Pazit', 'Roni', 'Sari', 'Tali',
            'Vered', 'Yafit', 'Zohara', 'Abigail', 'Batya',
            'Chen', 'Dalya', 'Edna', 'Fanny', 'Gila', 'Hana',
            'Irit', 'Julia', 'Kira', 'Leah', 'Miriam', 'Naama',
            'Odelia', 'Penina', 'Rona', 'Shirley', 'Tehila',
            'Urit', 'Vardit', 'Yasmin', 'Zahava',
        ],
        lastNames: [
            'Cohen', 'Levy', 'Mizrahi', 'Peretz', 'Katz', 'Friedman',
            'Shapiro', 'Goldberg', 'Weiss', 'Berman', 'Dayan',
            'Levi', 'Ben-David', 'Biton', 'Azoulay', 'Mor',
            'Haim', 'Avraham', 'Golan', 'Sharon', 'Peled',
            'Ofer', 'Nachman', 'Meir', 'Klein', 'Israeli',
            'Hochman', 'Greenberg', 'Feldman', 'Edelstein',
            'Dvir', 'Caspi', 'Ben-Ari', 'Alon', 'Zohar',
            'Yona', 'Wexler', 'Vainer', 'Tal', 'Sela',
            'Rotem', 'Rafaeli', 'Orbach', 'Natan', 'Moses',
            'Levin', 'Katzman', 'Jacobson', 'Inbar', 'Hadad',
        ],
        emailDomains: [
            'gmail.com', 'walla.co.il', 'bezeqint.net', 'hotmail.com',
            'outlook.com', 'yahoo.com', '012.net.il', 'live.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: bd — Bangladeshi / Bengali
     * COVERS: Bangladesh
     * ══════════════════════════════════════════════════════ */
    bd: {
        maleFirst: [
            'Mohammad', 'Md.', 'Rahman', 'Hossain', 'Islam', 'Rahim',
            'Karim', 'Salam', 'Hasan', 'Ali', 'Ahmed', 'Abdullah',
            'Farhan', 'Tanvir', 'Raihan', 'Arafat', 'Imran', 'Nayeem',
            'Shakib', 'Saif', 'Rafi', 'Zubaer', 'Fahim', 'Asif',
            'Nahid', 'Sajjad', 'Tomal', 'Minhaj', 'Sabbir', 'Akash',
            'Arman', 'Belal', 'Dipu', 'Emon', 'Faysal', 'Galib',
            'Habib', 'Iftekar', 'Joynal', 'Kawsar', 'Lutfar',
            'Mamun', 'Nafis', 'Opu', 'Palash', 'Riaz', 'Sohel',
            'Tanjim', 'Uday', 'Yasin',
        ],
        femaleFirst: [
            'Fatema', 'Nasrin', 'Nusrat', 'Sharmin', 'Rima', 'Sadia',
            'Mitu', 'Tania', 'Riya', 'Mousumi', 'Priya', 'Puja',
            'Asha', 'Mimi', 'Luna', 'Nilufar', 'Roksana', 'Sabina',
            'Taslima', 'Urmi', 'Vashti', 'Wahida', 'Yasmin',
            'Zannat', 'Ayesha', 'Bilkis', 'Champa', 'Dilruba',
            'Easha', 'Farida', 'Gulshan', 'Hasina', 'Iffat',
            'Jhorna', 'Kulsum', 'Layla', 'Mahfuza', 'Naznin',
            'Parvin', 'Rina', 'Shila', 'Tanima', 'Umme', 'Varsha',
            'Wendy', 'Xenia', 'Yeasmin', 'Zakia', 'Anwara', 'Beauty',
        ],
        lastNames: [
            'Rahman', 'Islam', 'Hossain', 'Ahmed', 'Akter', 'Khan',
            'Begum', 'Uddin', 'Ali', 'Hasan', 'Karim', 'Miah',
            'Sarkar', 'Chowdhury', 'Siddiqui', 'Bhuiyan', 'Nabi',
            'Sheikh', 'Molla', 'Talukder', 'Roy', 'Das', 'Paul',
            'Biswas', 'Ghosh', 'Mandal', 'Howlader', 'Mondol',
            'Abedin', 'Bari', 'Dey', 'Fakir', 'Gazi', 'Huq',
            'Iqbal', 'Joardar', 'Khandaker', 'Laskar', 'Munshi',
            'Noor', 'Prodhan', 'Quadery', 'Reza', 'Shikder',
            'Tarafdar', 'Bibi', 'Haider', 'Imam', 'Jalil', 'Kabir',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'live.com', 'bd.com', 'banglamail.com', 'protonmail.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: in — Indian
     * COVERS: India, Bhutan (fallback).
     * NOTE: Reflects India's most common pan-regional naming
     *       patterns, including Hindi, Tamil, Telugu, Kannada,
     *       Marathi, Bengali, Punjabi and Malayalam traditions.
     * ══════════════════════════════════════════════════════ */
    in: {
        maleFirst: [
            'Arjun', 'Rohit', 'Rahul', 'Vikas', 'Deepak', 'Sanjay',
            'Arun', 'Rajesh', 'Suresh', 'Mahesh', 'Ravi', 'Ajay',
            'Vijay', 'Amit', 'Aman', 'Ankit', 'Karan', 'Mohit',
            'Pranav', 'Siddharth', 'Tanmay', 'Abhishek', 'Gaurav',
            'Harish', 'Ishan', 'Lokesh', 'Manish', 'Naveen',
            'Pradeep', 'Ramesh', 'Sunil', 'Tushar', 'Uday',
            'Varun', 'Yogesh', 'Aditya', 'Bhavesh', 'Chetan',
            'Dinesh', 'Girish', 'Hitesh', 'Jayesh', 'Nilesh',
            'Paresh', 'Pratik', 'Satish', 'Vishal', 'Yash',
            'Sachin', 'Ashish',
        ],
        femaleFirst: [
            'Priya', 'Pooja', 'Neha', 'Sunita', 'Rekha', 'Sonia',
            'Nisha', 'Divya', 'Kavita', 'Meena', 'Geeta', 'Anita',
            'Priti', 'Rashmi', 'Sneha', 'Ritu', 'Swati', 'Usha',
            'Vandana', 'Archana', 'Deepika', 'Isha', 'Jyoti',
            'Kalpana', 'Lalita', 'Mamta', 'Nandita', 'Payal',
            'Radha', 'Sapna', 'Tanuja', 'Vidya', 'Yamini', 'Zoya',
            'Aakanksha', 'Bhavna', 'Chhaya', 'Dimple', 'Ekta',
            'Falguni', 'Harsha', 'Indira', 'Karuna', 'Laxmi',
            'Madhuri', 'Nikita', 'Parvati', 'Reena', 'Shweta', 'Trisha',
        ],
        lastNames: [
            'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel',
            'Shah', 'Mehta', 'Joshi', 'Nair', 'Rao', 'Reddy',
            'Pillai', 'Iyer', 'Menon', 'Prasad', 'Sinha', 'Mishra',
            'Pandey', 'Chaudhary', 'Tiwari', 'Dubey', 'Saxena',
            'Agarwal', 'Bansal', 'Goel', 'Mittal', 'Malhotra',
            'Kapoor', 'Chopra', 'Bhatia', 'Khanna', 'Arora',
            'Srivastava', 'Trivedi', 'Upadhyay', 'Yadav', 'Bajaj',
            'Choudhury', 'Deshpande', 'Ghosh', 'Kulkarni', 'Lal',
            'Mukherjee', 'Naik', 'Patil', 'Rajan', 'Sawant',
            'Thakur',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.in', 'hotmail.com', 'rediffmail.com',
            'outlook.com', 'yahoo.co.in', 'icloud.com', 'live.in',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: pk — Pakistani / Urdu
     * COVERS: Pakistan
     * ══════════════════════════════════════════════════════ */
    pk: {
        maleFirst: [
            'Muhammad', 'Ali', 'Hassan', 'Usman', 'Omar', 'Ibrahim',
            'Ahmed', 'Abdullah', 'Hamza', 'Bilal', 'Tariq', 'Asad',
            'Kamran', 'Naveed', 'Rizwan', 'Shahid', 'Farhan',
            'Imran', 'Zubair', 'Saad', 'Waleed', 'Yusuf', 'Zahid',
            'Amir', 'Babar', 'Dawood', 'Ehsan', 'Faisal', 'Ghulam',
            'Haider', 'Junaid', 'Kashif', 'Liaquat', 'Mansoor',
            'Nasir', 'Pervaiz', 'Qaiser', 'Rashid', 'Salman',
            'Tahir', 'Uzair', 'Waseem', 'Khalid', 'Murad',
            'Sajid', 'Tanveer', 'Jawad', 'Haris', 'Shoaib',
        ],
        femaleFirst: [
            'Fatima', 'Zainab', 'Ayesha', 'Mariam', 'Sana', 'Hira',
            'Nadia', 'Samina', 'Shazia', 'Rabia', 'Bushra', 'Amina',
            'Saira', 'Gulnaz', 'Naheed', 'Sadia', 'Uzma', 'Yasmeen',
            'Asma', 'Beenish', 'Dua', 'Erum', 'Farah', 'Ghazala',
            'Huma', 'Irum', 'Jaweria', 'Kiran', 'Lubna', 'Maryam',
            'Nazia', 'Pakeeza', 'Razia', 'Sadaf', 'Tabassum',
            'Urooj', 'Sumera', 'Sobia', 'Shehnaz', 'Rubab',
            'Rimsha', 'Rehana', 'Qurat-ul-Ain', 'Noreen', 'Mahnoor',
            'Laraib', 'Kinza', 'Javeria', 'Iqra', 'Hafsa',
        ],
        lastNames: [
            'Khan', 'Ahmed', 'Ali', 'Shah', 'Malik', 'Qureshi',
            'Siddiqui', 'Butt', 'Hussain', 'Chaudhry', 'Rana',
            'Akhtar', 'Baig', 'Mirza', 'Sheikh', 'Ansari',
            'Abbasi', 'Bhatti', 'Cheema', 'Dogar', 'Farooqi',
            'Gillani', 'Hashmi', 'Iqbal', 'Javed', 'Kashmiri',
            'Leghari', 'Mengal', 'Nawaz', 'Pasha', 'Rathore',
            'Siddiqi', 'Tarar', 'Usmani', 'Zaidi', 'Ashraf',
            'Bodla', 'Chishti', 'Gondal', 'Hayat', 'Khawaja',
            'Lodhi', 'Mian', 'Niazi', 'Paracha', 'Rajput',
            'Sandhu', 'Tiwana', 'Warraich', 'Zahoor', 'Alvi',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'live.com', 'yahoo.co.pk', 'paknet.com.pk', 'protonmail.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: np — Nepali
     * COVERS: Nepal
     * ══════════════════════════════════════════════════════ */
    np: {
        maleFirst: [
            'Arjun', 'Suraj', 'Rajesh', 'Deepak', 'Arun', 'Sanjay',
            'Santosh', 'Ram', 'Shyam', 'Hari', 'Bijay', 'Binod',
            'Kamal', 'Nabin', 'Pawan', 'Saroj', 'Suresh', 'Prakash',
            'Sagar', 'Naresh', 'Anish', 'Bikash', 'Dipesh', 'Gopal',
            'Hem', 'Jitendra', 'Krishna', 'Lalit', 'Milan', 'Niraj',
            'Om', 'Pradeep', 'Rabindra', 'Sachin', 'Tilak', 'Upendra',
            'Vipul', 'Yogendra', 'Amrit', 'Bhupendra', 'Chandra',
            'Dinesh', 'Eshan', 'Ganesh', 'Hari', 'Ishan',
            'Jeet', 'Kiran', 'Laxman', 'Madhav',
        ],
        femaleFirst: [
            'Sita', 'Gita', 'Sunita', 'Kopila', 'Priya', 'Puja',
            'Rekha', 'Mina', 'Rina', 'Laxmi', 'Saraswati', 'Durga',
            'Kamala', 'Anita', 'Rita', 'Nisha', 'Sanju', 'Samjhana',
            'Tara', 'Uma', 'Vandana', 'Yamuna', 'Zeenat', 'Archana',
            'Bina', 'Champa', 'Devi', 'Ekta', 'Fatima', 'Geeta',
            'Hira', 'Indira', 'Jyoti', 'Kabita', 'Lalita',
            'Manisha', 'Namrata', 'Ojha', 'Pabitra', 'Radha',
            'Savita', 'Tulasa', 'Usha', 'Vajra', 'Yashoda',
            'Anjali', 'Binita', 'Chandrika', 'Dipika', 'Elina',
        ],
        lastNames: [
            'Shrestha', 'Sharma', 'Tamang', 'Thapa', 'Gurung',
            'Rai', 'Magar', 'Karki', 'Regmi', 'Adhikari',
            'Basnet', 'Bhattarai', 'Dahal', 'Ghimire', 'Joshi',
            'Khanal', 'Lamichhane', 'Mainali', 'Neupane', 'Ojha',
            'Paudel', 'Rijal', 'Subedi', 'Tiwari', 'Upadhyay',
            'Bajracharya', 'Chaudhary', 'Devkota', 'Hamal',
            'Koirala', 'Lama', 'Mahato', 'Pandey', 'Prajapati',
            'Raut', 'Sapkota', 'Tuladhar', 'Yadav', 'Acharya',
            'Biswakarma', 'Chhetri', 'Dhakal', 'Gaire', 'Humagain',
            'Kafle', 'Luitel', 'Murmi', 'Panta', 'Rana', 'Siwakoti',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'ntc.net.np', 'mail.com.np', 'live.com', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: lk — Sri Lankan
     * COVERS: Sri Lanka
     * ══════════════════════════════════════════════════════ */
    lk: {
        maleFirst: [
            'Nuwan', 'Chaminda', 'Lahiru', 'Kasun', 'Isuru', 'Dilan',
            'Tharaka', 'Asanka', 'Buddika', 'Saman', 'Prasad',
            'Chathura', 'Danushka', 'Eranga', 'Gayan', 'Hirantha',
            'Indunil', 'Janaka', 'Kavinda', 'Lasith', 'Malith',
            'Namal', 'Oshada', 'Pathum', 'Ravindu', 'Sachith',
            'Thisara', 'Udana', 'Vimukthi', 'Waniga', 'Yasiru',
            'Asela', 'Binura', 'Charith', 'Damith', 'Eranda',
            'Farhan', 'Geeth', 'Hasantha', 'Ishan', 'Jayasuriya',
            'Kusal', 'Liyanage', 'Madushanka', 'Nandun', 'Oshan',
            'Priyamal', 'Randiv', 'Shehan', 'Tharindu', 'Uresha',
        ],
        femaleFirst: [
            'Dilhani', 'Kumari', 'Nadeeka', 'Sanduni', 'Thilini',
            'Anusha', 'Buddhika', 'Chamari', 'Damayanthi', 'Eranga',
            'Fathima', 'Gayani', 'Hiruni', 'Inoka', 'Jayani',
            'Kavindya', 'Lakmini', 'Malsha', 'Nipuni', 'Omali',
            'Pavithra', 'Rashmi', 'Sachini', 'Thisuri', 'Udari',
            'Vindya', 'Waruni', 'Yashoda', 'Zinara', 'Achini',
            'Binara', 'Chethana', 'Dayani', 'Erandhi', 'Fathimath',
            'Gimhani', 'Hasini', 'Ishari', 'Jenita', 'Kithmi',
            'Lasandi', 'Maheshi', 'Navodya', 'Oshadi', 'Piumi',
            'Ridmi', 'Sathsarani', 'Tharushi', 'Upeksha', 'Viboshana',
        ],
        lastNames: [
            'Perera', 'Fernando', 'Silva', 'De Silva', 'Jayawardena',
            'Wickramasinghe', 'Bandara', 'Gunawardena', 'Kumara',
            'Rajapaksha', 'Wijesekara', 'Dissanayake', 'Herath',
            'Liyanage', 'Marasinghe', 'Nanayakkara', 'Pathirana',
            'Ranaweera', 'Senaratne', 'Thiruchelvam', 'Udawatta',
            'Vidanapathirana', 'Weerasinghe', 'Yapa', 'Zoysa',
            'Abeykoon', 'Balasuriya', 'Chandrasekera', 'Dharmasena',
            'Ekanayake', 'Fonseka', 'Gunasekara', 'Hapuarachchi',
            'Illeperuma', 'Jayasinghe', 'Karunathilaka', 'Lokuge',
            'Muthulingam', 'Nandadasa', 'Obeyesekere', 'Peiris',
            'Ratnayake', 'Subasinghe', 'Thennakoon', 'Ukwatta',
            'Vithanage', 'Wimalasiri', 'Yasarathna', 'Abeywickrama', 'Ruwanpathirana',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'slt.lk', 'dialog.lk', 'mobitel.lk', 'live.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: cn — Chinese
     * COVERS: China, Taiwan, North Korea (partial).
     * NOTE: Romanised via standard Mandarin Pinyin.
     * ══════════════════════════════════════════════════════ */
    cn: {
        maleFirst: [
            'Wei', 'Fang', 'Cheng', 'Jian', 'Liang', 'Lei',
            'Tao', 'Hao', 'Ming', 'Zhi', 'Rui', 'Peng',
            'Yong', 'Gang', 'Bin', 'Xian', 'Kai', 'Jie',
            'Yang', 'Feng', 'Jun', 'Hao', 'Zhong', 'Sheng',
            'Long', 'Xin', 'Dong', 'Bao', 'Guang', 'Shan',
            'Ang', 'Bo', 'Chao', 'Da', 'Enbo', 'Fuwen',
            'Guang', 'Haoran', 'Jiahao', 'Kexin', 'Liangjie',
            'Mingzhe', 'Nian', 'Ou', 'Peiran', 'Qianlong',
            'Runjie', 'Siyuan', 'Tianze', 'Weitao',
        ],
        femaleFirst: [
            'Fang', 'Li', 'Na', 'Hua', 'Mei', 'Ting', 'Juan',
            'Yan', 'Xia', 'Yun', 'Ying', 'Lin', 'Qian', 'Jing',
            'Xin', 'Ning', 'Min', 'Lan', 'Shan', 'Rui',
            'Aiqing', 'Baili', 'Chunhua', 'Dandan', 'Erlan',
            'Feifei', 'Guiying', 'Hongmei', 'Jiayu', 'Kexin',
            'Lingling', 'Meiyu', 'Nianzhi', 'Ouyang', 'Peiling',
            'Qianqian', 'Ruixue', 'Shanshan', 'Tingting', 'Wenxiu',
            'Xiaoyan', 'Yanling', 'Yumei', 'Ziling', 'Anqi',
            'Beibei', 'Caiyun', 'Danzhu', 'Enjie',
        ],
        lastNames: [
            'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang',
            'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun', 'Ma', 'Zhu', 'Hu',
            'Guo', 'He', 'Lin', 'Gao', 'Luo', 'Zheng', 'Liang',
            'Xie', 'Tang', 'Han', 'Cao', 'Xu', 'Deng', 'Feng',
            'Shen', 'Peng', 'Cai', 'Lu', 'Pan', 'Jiang', 'Cui',
            'Qin', 'Cheng', 'Yan', 'Hua', 'Xiao', 'Bai', 'Tian',
            'Min', 'Wen', 'Wei', 'Fan', 'Kong', 'Lei', 'Mo',
        ],
        emailDomains: [
            'gmail.com', 'qq.com', '163.com', '126.com',
            'sina.com', 'sohu.com', 'hotmail.com', 'outlook.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: jp — Japanese
     * COVERS: Japan
     * NOTE: Romanised via Hepburn romanisation.
     * ══════════════════════════════════════════════════════ */
    jp: {
        maleFirst: [
            'Haruto', 'Yuto', 'Sota', 'Yuki', 'Hayato', 'Kakeru',
            'Ren', 'Takumi', 'Kento', 'Ryota', 'Shota', 'Keita',
            'Daiki', 'Naoki', 'Yusei', 'Hiroto', 'Koki', 'Riku',
            'Ryusei', 'Taichi', 'Akira', 'Daisuke', 'Fumiya',
            'Gaku', 'Hideaki', 'Isamu', 'Junpei', 'Kazuki',
            'Makoto', 'Nobuhiro', 'Osamu', 'Ryoji', 'Satoshi',
            'Tatsuya', 'Yasushi', 'Yoshihiro', 'Ayumu', 'Eita',
            'Kosei', 'Minato', 'Nao', 'Shun', 'Tomoaki',
            'Wataru', 'Yusuke', 'Kenji', 'Masato', 'Tomo', 'Hiroki',
        ],
        femaleFirst: [
            'Yui', 'Hina', 'Sakura', 'Honoka', 'Aoi', 'Nanami',
            'Mio', 'Nana', 'Miyu', 'Rin', 'Shiori', 'Yuna',
            'Haruka', 'Aya', 'Misaki', 'Kana', 'Sana', 'Emi',
            'Ami', 'Mai', 'Koharu', 'Runa', 'Yuka', 'Nozomi',
            'Akane', 'Ayane', 'Chiaki', 'Erika', 'Fuka', 'Hazuki',
            'Izumi', 'Junko', 'Kazumi', 'Maiko', 'Natsumi',
            'Otome', 'Reiko', 'Saki', 'Tomoko', 'Umi', 'Wakana',
            'Yoshimi', 'Yukari', 'Kiko', 'Manami', 'Noriko',
            'Riko', 'Sumire', 'Tomoyo', 'Yuriko',
        ],
        lastNames: [
            'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe',
            'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato',
            'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto',
            'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Yamazaki',
            'Mori', 'Abe', 'Ikeda', 'Hashimoto', 'Yamashita',
            'Ishikawa', 'Nakajima', 'Maeda', 'Fujita', 'Ogawa',
            'Goto', 'Okamoto', 'Hasegawa', 'Murakami', 'Kondo',
            'Ishii', 'Saito', 'Fujii', 'Nishimura', 'Okada',
            'Matsuda', 'Nakagawa', 'Harada', 'Ono', 'Tamura',
            'Aoki', 'Araki', 'Doi', 'Fujiwara', 'Kinoshita',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.co.jp', 'docomo.ne.jp', 'softbank.ne.jp',
            'au.com', 'hotmail.co.jp', 'outlook.jp', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: kr — Korean
     * COVERS: South Korea, North Korea.
     * NOTE: Romanised via Revised Romanisation of Korean.
     * ══════════════════════════════════════════════════════ */
    kr: {
        maleFirst: [
            'Minho', 'Jinho', 'Junho', 'Jihun', 'Seojun', 'Jiwoo',
            'Hyunwoo', 'Hyunjun', 'Jaehyun', 'Jaemin', 'Sungmin',
            'Donghyun', 'Sanghyun', 'Kyunghoon', 'Jinwoo', 'Sungjae',
            'Taehyung', 'Jeongguk', 'Namjoon', 'Seokjin', 'Yoongi',
            'Hoseok', 'Jimin', 'Wonwoo', 'Mingyu', 'Minghao',
            'Dokyeom', 'Seungkwan', 'Vernon', 'Dino', 'Woozi',
            'Seungcheol', 'Jeonghan', 'Hansol', 'Joshua', 'Jun',
            'Bumzu', 'Chanwoo', 'Daehyun', 'Eunkwang', 'Gayoon',
            'Hyunsik', 'Ilhoon', 'Jooheon', 'Kibum', 'Lagoon',
            'Minhyuk', 'Nawon', 'Onew', 'Peniel',
        ],
        femaleFirst: [
            'Jiyeon', 'Soyeon', 'Hayeon', 'Seoyeon', 'Chaeyeon',
            'Jiwon', 'Sooyoung', 'Hyoyeon', 'Taeyeon', 'Yoona',
            'Yuri', 'Tiffany', 'Seohyun', 'Sunny', 'Yoojung',
            'Nayeon', 'Jeongyeon', 'Momo', 'Sana', 'Jihyo',
            'Mina', 'Dahyun', 'Chaeyoung', 'Tzuyu', 'Irene',
            'Seulgi', 'Wendy', 'Joy', 'Yeri', 'Suzy',
            'IU', 'Hyuna', 'Gain', 'Fiestar', 'Eunji',
            'Naeun', 'Chorong', 'Bomi', 'Namjoo', 'Hayoung',
            'Krystal', 'Victoria', 'Amber', 'Luna', 'Jinah',
            'Kyungri', 'Sunhwa', 'Hyomin', 'Soyou', 'Yubin',
        ],
        lastNames: [
            'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho',
            'Yoon', 'Jang', 'Lim', 'Oh', 'Han', 'Shin', 'Seo',
            'Kwon', 'Hwang', 'Ahn', 'Song', 'Ryu', 'Hong',
            'Baek', 'Yoo', 'Moon', 'Yang', 'Noh', 'Jeong',
            'Ha', 'Ko', 'Nam', 'Sim', 'Pyo', 'Chung',
            'Min', 'Eom', 'Kong', 'Woo', 'Ma', 'Gi',
            'Bo', 'So', 'Wi', 'Pi', 'Ye', 'Ryoo',
            'Son', 'Heo', 'Bae', 'Byeon', 'Cheon', 'Do',
        ],
        emailDomains: [
            'gmail.com', 'naver.com', 'daum.net', 'kakao.com',
            'hanmail.net', 'nate.com', 'hotmail.com', 'outlook.kr',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: vn — Vietnamese
     * COVERS: Vietnam
     * ══════════════════════════════════════════════════════ */
    vn: {
        maleFirst: [
            'Minh', 'Hùng', 'Dũng', 'Nam', 'Hải', 'Tuấn', 'Long',
            'Thành', 'Trung', 'Đức', 'Bình', 'Khoa', 'Cường',
            'Phúc', 'Quang', 'Tài', 'Sơn', 'Vũ', 'Hoàng',
            'Anh', 'Bảo', 'Chiến', 'Duy', 'Gia', 'Hậu',
            'Khang', 'Lâm', 'Nhân', 'Tiến', 'Việt',
            'Đạt', 'Kiên', 'Lộc', 'Nguyên', 'Phong',
            'Thanh', 'Trọng', 'Xuân', 'Yên', 'Ân',
            'Công', 'Đình', 'Hào', 'Kha', 'Lê',
            'Nghĩa', 'Phát', 'Tân', 'Ưng', 'Vinh',
        ],
        femaleFirst: [
            'Lan', 'Hoa', 'Mai', 'Thu', 'Hương', 'Linh', 'Trang',
            'Thảo', 'Ngọc', 'Thanh', 'Nga', 'Yến', 'Phương',
            'Huệ', 'Vy', 'Kim', 'Diệu', 'Hiền', 'Nhung', 'Vân',
            'An', 'Bích', 'Chi', 'Dương', 'Giang', 'Hạnh',
            'Khánh', 'Lê', 'Mỹ', 'Nhi', 'Oanh', 'Quỳnh',
            'Thúy', 'Xuân', 'Ái', 'Bảo', 'Châu', 'Đào',
            'Hằng', 'Kiều', 'Mỵ', 'Nhàn', 'Quyên', 'Tâm',
            'Uyên', 'Vũ', 'Yên', 'Ánh', 'Lý', 'Ngân',
        ],
        lastNames: [
            'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh',
            'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ',
            'Ngô', 'Dương', 'Lý', 'Phan', 'Trương', 'Đinh',
            'Đoàn', 'Hà', 'Khúc', 'Lâm', 'Mạc', 'Nghiêm',
            'Quách', 'Tô', 'Uông', 'Viên', 'Thái', 'Nông',
            'Cao', 'Cù', 'Giáp', 'Hứa', 'Khổng', 'Liêu',
            'Mai', 'Ninh', 'Ô', 'Quan', 'Sầm', 'Tạ',
            'Ứng', 'Văn', 'Chu', 'Đào', 'Giang', 'Kiều',
            'Mã', 'Tiêu',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com.vn', 'hotmail.com', 'outlook.com',
            'vnn.vn', 'fpt.vn', 'vnpt.vn', 'live.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: th — Thai
     * COVERS: Thailand
     * NOTE: Romanised via Royal Thai General System.
     * ══════════════════════════════════════════════════════ */
    th: {
        maleFirst: [
            'Somchai', 'Kitti', 'Nattaphon', 'Phichit', 'Rachan',
            'Sombat', 'Teerayut', 'Wirat', 'Yothin', 'Anuwat',
            'Boonchai', 'Chai', 'Decha', 'Ekachai', 'Fong',
            'Grom', 'Hiran', 'Ittipat', 'Jannat', 'Kamon',
            'Ladda', 'Manop', 'Niran', 'Othai', 'Prayut',
            'Ratchanon', 'Sarun', 'Thitipong', 'Udom', 'Veerasak',
            'Wanchai', 'Xayavong', 'Yongyuth', 'Zin', 'Aroon',
            'Bancha', 'Chatri', 'Damri', 'Ekkasit', 'Faisal',
            'Gitsana', 'Honthong', 'Isara', 'Jatupol', 'Krich',
            'Lumpong', 'Monthon', 'Narong', 'Panya', 'Rungrot',
        ],
        femaleFirst: [
            'Nattaporn', 'Siriporn', 'Wilailak', 'Yuparat', 'Arunee',
            'Boontarika', 'Chompoo', 'Darunee', 'Ekaporn', 'Fang',
            'Ganya', 'Hathai', 'Ittima', 'Jutamas', 'Kanchana',
            'Lalita', 'Malee', 'Narumon', 'Orathai', 'Patchara',
            'Rattana', 'Siranee', 'Tawan', 'Ubolrat', 'Vanida',
            'Wanpen', 'Ying', 'Zarin', 'Auratham', 'Benchamas',
            'Chalida', 'Danai', 'Emporn', 'Fuangfa', 'Gawin',
            'Hataiporn', 'Inthira', 'Jirapat', 'Kullanit', 'Lulita',
            'Monthakan', 'Napas', 'Onuma', 'Phantip', 'Ranya',
            'Supansa', 'Thanyarat', 'Usanee', 'Wassana', 'Yaiwan',
        ],
        lastNames: [
            'Thongchai', 'Kiatpaisit', 'Jantarasri', 'Panichkul',
            'Rungrojchaiporn', 'Siriwan', 'Thammasak', 'Wongmanee',
            'Yimlamai', 'Aroonsri', 'Buranasombati', 'Chaiyo',
            'Damrongrak', 'Ekpol', 'Fuengfookul', 'Glinsukon',
            'Harnchai', 'Inchai', 'Jitprasert', 'Kaewkla',
            'Limsakul', 'Mongkol', 'Namwong', 'Oophasit', 'Pintachan',
            'Ratanaruangpan', 'Srisuk', 'Teerawong', 'Urairat',
            'Vikitset', 'Wansuk', 'Yimyaem', 'Arjharn', 'Booncherd',
            'Chotiwat', 'Dechapong', 'Eimwong', 'Fungkasem',
            'Hongsri', 'Inprom', 'Jangkhuong', 'Kraisri',
            'Longlap', 'Mukdawarayuth', 'Nanakul', 'Ophat',
            'Phatcharapong', 'Ritkla', 'Suphanit', 'Thintalang',
        ],
        emailDomains: [
            'gmail.com', 'hotmail.com', 'yahoo.co.th', 'outlook.com',
            'truemail.co.th', 'thaimail.com', 'live.com', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: ph — Filipino
     * COVERS: Philippines
     * ══════════════════════════════════════════════════════ */
    ph: {
        maleFirst: [
            'Juan', 'Jose', 'Miguel', 'Carlo', 'Angelo', 'Mark',
            'Christian', 'Ryan', 'Jason', 'John', 'Michael', 'Kevin',
            'Kyle', 'Patrick', 'Daniel', 'Jolo', 'Paolo', 'Josh',
            'Alex', 'Andy', 'Bong', 'Cha', 'Dave', 'Eddie',
            'Felix', 'Gary', 'Henry', 'Ian', 'Jomar', 'Kenneth',
            'Larry', 'Mario', 'Neil', 'Oscar', 'Peter', 'Ramon',
            'Samuel', 'Tony', 'Vic', 'Wesley', 'Xyrus', 'Yvan',
            'Zaldy', 'Arnel', 'Benny', 'Cris', 'Donny', 'Erwin',
            'Franz', 'Gino',
        ],
        femaleFirst: [
            'Maria', 'Anna', 'Liza', 'Jenny', 'Maricel', 'Rosario',
            'Cristina', 'Luz', 'Glenda', 'Edith', 'Marites', 'Lourdes',
            'Sarah', 'Joanne', 'Nikki', 'Christine', 'Cynthia',
            'Rowena', 'Cheryl', 'Aileen', 'Bernadette', 'Clara',
            'Daisy', 'Eloisa', 'Faith', 'Gemma', 'Hannah', 'Irene',
            'Jasmine', 'Karen', 'Laura', 'Michelle', 'Nancy',
            'Olivia', 'Patricia', 'Queenie', 'Rebecca', 'Sheila',
            'Tina', 'Ursula', 'Vanessa', 'Wendy', 'Xyza', 'Yvonne',
            'Zara', 'Angeline', 'Bianca', 'Carmela', 'Diana', 'Elvira',
        ],
        lastNames: [
            'Santos', 'Reyes', 'Cruz', 'Garcia', 'Ramos', 'Flores',
            'Domingo', 'Villanueva', 'Ramirez', 'Bautista', 'Gonzalez',
            'Pascual', 'Aquino', 'Lopez', 'Dela Cruz', 'Mendoza',
            'Torres', 'Rivera', 'Morales', 'Mercado', 'Castillo',
            'Abad', 'Benedicto', 'Cabrera', 'David', 'Enriquez',
            'Fernandez', 'Gutierrez', 'Hernandez', 'Ilagan',
            'Jacinto', 'Kalaw', 'Legaspi', 'Madrigal', 'Navarro',
            'Ocampo', 'Policarpio', 'Quezon', 'Roxas', 'Santiago',
            'Tolentino', 'Uy', 'Valencia', 'Wenceslao', 'Xavier',
            'Yap', 'Zubiri', 'Alcantara', 'Buenaventura', 'Corpuz',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'yahoo.com.ph', 'live.com', 'icloud.com', 'protonmail.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: id — Indonesian / Malay
     * COVERS: Indonesia, Malaysia, Brunei.
     * ══════════════════════════════════════════════════════ */
    id: {
        maleFirst: [
            'Budi', 'Agus', 'Hendra', 'Andri', 'Doni', 'Fajar',
            'Rizky', 'Wahyu', 'Andi', 'Bagas', 'Dicky', 'Eko',
            'Fandi', 'Gilang', 'Haris', 'Ilham', 'Jaka', 'Kevin',
            'Lutfi', 'Mahendra', 'Nanda', 'Oki', 'Panji', 'Ricky',
            'Satria', 'Taufik', 'Uju', 'Vicky', 'Wisnu', 'Yoga',
            'Zaki', 'Arif', 'Bayu', 'Chandra', 'Dimas', 'Erwin',
            'Fahri', 'Galih', 'Hamid', 'Irwan', 'Joko', 'Krisna',
            'Luthfi', 'Miko', 'Nanang', 'Okky', 'Pandu', 'Rangga',
            'Sigit', 'Teguh',
        ],
        femaleFirst: [
            'Dewi', 'Sri', 'Sari', 'Indah', 'Rina', 'Wulandari',
            'Rahayu', 'Fitri', 'Nurul', 'Putri', 'Anisa', 'Bella',
            'Citra', 'Dina', 'Eka', 'Fenny', 'Gita', 'Hana',
            'Intan', 'Julia', 'Kartika', 'Lela', 'Mira', 'Nisa',
            'Okta', 'Puji', 'Ratih', 'Sinta', 'Tina', 'Ulin',
            'Vina', 'Wahyuni', 'Yunita', 'Zahra', 'Ayu', 'Bunga',
            'Clara', 'Diah', 'Elma', 'Fika', 'Gina', 'Hesti',
            'Irma', 'Juwita', 'Lusi', 'Maya', 'Neli', 'Oka',
            'Reni', 'Selvi',
        ],
        lastNames: [
            'Santoso', 'Wijaya', 'Setiawan', 'Pratama', 'Nugroho',
            'Permana', 'Saputra', 'Kurniawan', 'Wibowo', 'Hidayat',
            'Suryadi', 'Gunawan', 'Hartono', 'Susanto', 'Raharjo',
            'Utama', 'Widodo', 'Yusuf', 'Zainal', 'Ardian',
            'Baskara', 'Cahyono', 'Darmawan', 'Efendi', 'Fadhil',
            'Ginting', 'Hasibuan', 'Ibrahim', 'Jaya', 'Kusuma',
            'Lukman', 'Maulana', 'Nasution', 'Oktavian', 'Pramono',
            'Ramadhan', 'Siregar', 'Tarigan', 'Usman', 'Wahyudi',
            'Yunus', 'Zulkarnain', 'Adi', 'Bambang', 'Cahya',
            'Dharma', 'Fauzi', 'Gani', 'Hadi', 'Indra',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.co.id', 'hotmail.com', 'outlook.com',
            'mail.id', 'live.com', 'ymail.com', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: kh — Khmer / Cambodian
     * COVERS: Cambodia
     * ══════════════════════════════════════════════════════ */
    kh: {
        maleFirst: [
            'Sokha', 'Dara', 'Chanda', 'Piseth', 'Ratha', 'Sovan',
            'Vuthy', 'Kosal', 'Makara', 'Nimol', 'Oudom', 'Phirum',
            'Reaksmey', 'Serey', 'Theara', 'Unna', 'Vibol', 'Wath',
            'Yeang', 'Zaman', 'Bunna', 'Chamroeun', 'Dith', 'Ekarin',
            'Fara', 'Ghim', 'Heng', 'Ith', 'Jian', 'Keo',
            'Leng', 'Mony', 'Narith', 'Panha', 'Ra', 'Sopheak',
            'Tola', 'Udom', 'Vann', 'Yim', 'Ary', 'Bora',
            'Chan', 'Dom', 'Em', 'Hak', 'Khorn', 'Lin',
            'Meas', 'Neak',
        ],
        femaleFirst: [
            'Sreymom', 'Kunthea', 'Socheata', 'Phirum', 'Sreyneath',
            'Davan', 'Eang', 'Farina', 'Gita', 'Hav', 'Ith',
            'Jenda', 'Kokhmer', 'Leakhena', 'Malis', 'Nary',
            'Oun', 'Pich', 'Ratanak', 'Sothea', 'Tola', 'Unn',
            'Vantha', 'Wanna', 'Yaroeun', 'Amara', 'Bunroeun',
            'Channary', 'Dariya', 'Eda', 'Funn', 'Hema', 'Itha',
            'Jema', 'Khema', 'Lila', 'Mey', 'Nida', 'Opaline',
            'Panny', 'Remy', 'Sema', 'Teva', 'Ula', 'Vanna',
            'Wina', 'Yema', 'Zara', 'Aliya', 'Bona',
        ],
        lastNames: [
            'Chan', 'Kim', 'Sok', 'Chea', 'Ly', 'Nhem', 'Pov',
            'Ros', 'Seng', 'Yim', 'Ang', 'Bun', 'Chhoun',
            'Danh', 'Ean', 'Fath', 'Hok', 'In', 'Kaing',
            'Leung', 'Mam', 'Nup', 'Oun', 'Phal', 'Rin',
            'Sam', 'Tep', 'Un', 'Van', 'Yoeum', 'Cham',
            'Dim', 'Ek', 'Gong', 'Hem', 'Iv', 'Kao',
            'Lorn', 'Mok', 'Nhat', 'Ouk', 'Pin', 'Roeun',
            'Seang', 'Thong', 'Uch', 'Var', 'Yeng', 'Ze', 'Buth',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'khmer.com', 'live.com', 'online.com.kh', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: la — Lao
     * COVERS: Laos
     * ══════════════════════════════════════════════════════ */
    la: {
        maleFirst: [
            'Khamphet', 'Somphong', 'Bounnhong', 'Phouthone', 'Vilayphone',
            'Khamla', 'Sengdara', 'Bouasone', 'Phouvieng', 'Thongsing',
            'Anoulak', 'Bounleua', 'Chanthalangsy', 'Dalavong', 'Eka',
            'Fongsamath', 'Gnaikham', 'Houmphanh', 'Inpeng', 'Jotiphone',
            'Kaisone', 'Lamphanh', 'Malaphone', 'Nouhak', 'Ounheuan',
            'Phouma', 'Rasphone', 'Singkham', 'Thongloun', 'Unsiri',
            'Vongsa', 'Wattana', 'Xaysomphone', 'Yanasith', 'Zakhamphan',
            'Bounna', 'Chanthaphone', 'Detphone', 'Ekphone', 'Faikham',
            'Houmpha', 'Keovilay', 'Latsamy', 'Phimmasone', 'Somvang',
            'Thavisak', 'Vilavong', 'Xayphone', 'Yotha', 'Boua',
        ],
        femaleFirst: [
            'Khamla', 'Souvanh', 'Phouthong', 'Naly', 'Bounmee',
            'Chansy', 'Daovone', 'Ekaluck', 'Fongsamone', 'Hatsady',
            'Inthava', 'Janphet', 'Keovilay', 'Latsamy', 'Malichan',
            'Nakhon', 'Outhai', 'Phimmasone', 'Ratsamy', 'Soulyvone',
            'Thongsamai', 'Urai', 'Vilayphone', 'Wanthida', 'Xaysaly',
            'Yupa', 'Bounla', 'Chanahome', 'Daovilay', 'Ekavone',
            'Faikham', 'Gnaikham', 'Houmphan', 'Inthala', 'Janthna',
            'Kaewyaphorn', 'Lalida', 'Manyvanh', 'Nithda', 'Oukham',
            'Phimtha', 'Rasamy', 'Sengmany', 'Thidavanh', 'Vongphet',
            'Xaykham', 'Ying', 'Alounna', 'Bouasavanh', 'Chanthala',
        ],
        lastNames: [
            'Phommasack', 'Vongsay', 'Keolasy', 'Phouthavong',
            'Bounpheng', 'Chanthavong', 'Douangmany', 'Ekkeomma',
            'Fongsamout', 'Haiphong', 'Inthirath', 'Jolivong',
            'Keovilay', 'Luangrath', 'Mounivong', 'Nammavong',
            'Ounheuan', 'Phommathep', 'Ratsavong', 'Souphavanh',
            'Thavonsouk', 'Vorachith', 'Xayyavong', 'Yiaseng',
            'Bouapha', 'Chaleunxay', 'Daovong', 'Ekphommarak',
            'Faikhamvong', 'Gnaisone', 'Homvongsa', 'Inthala',
            'Khamphanh', 'Liengsone', 'Moukhong', 'Navongsa',
            'Ouvong', 'Phengsavanh', 'Rasaphone', 'Sivilay',
            'Thongsombat', 'Vilayvong', 'Xayphanya', 'Yommasith',
            'Bounmi', 'Chanthasy', 'Dethsy', 'Ekavongsay', 'Faisone', 'Hongkham',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'laopdr.com', 'live.com', 'mail.la', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: mm — Burmese / Myanmar
     * COVERS: Myanmar
     * ══════════════════════════════════════════════════════ */
    mm: {
        maleFirst: [
            'Aung', 'Kyaw', 'Min', 'Zaw', 'Soe', 'Htet', 'Win',
            'Thura', 'Pyae', 'Thiha', 'Yan', 'Naing', 'Kaung',
            'Phyo', 'Bo', 'Htike', 'Zin', 'Myo', 'Thu',
            'Nay', 'Sithu', 'Tun', 'Wai', 'Myat', 'Ko',
            'Lwin', 'Htun', 'Shwe', 'Nanda', 'Paing',
            'Kyar', 'Zeyar', 'Thet', 'San', 'Aye', 'Khant',
            'Zar', 'Yan Aung', 'Hein', 'Mg', 'Nyi', 'Oo',
            'Pyinnyar', 'Razak', 'Sein', 'Thaung', 'Yone',
            'Zawgyi', 'Ananda', 'Bhone',
        ],
        femaleFirst: [
            'Su', 'Ei', 'Khin', 'Thida', 'Aye', 'Mya', 'Nwe',
            'Yamin', 'Phyo', 'Zarchi', 'May', 'Phyu', 'Mi',
            'Wint', 'Thazin', 'Nan', 'Sandar', 'Hnin', 'Pan',
            'Myat', 'Kalyar', 'Zar', 'Tha', 'Nyein', 'San',
            'Yee', 'Nu', 'Me', 'Lay', 'Thet', 'Shwe',
            'Marlar', 'Zin', 'Kyi', 'Hla', 'War', 'Htwe',
            'Khine', 'Lin', 'Lwin', 'Tay', 'Waing', 'Ye',
            'Zayar', 'Amara', 'Bawga', 'Chaw', 'Daw', 'Eindra', 'Fong',
        ],
        lastNames: [
            'Htun', 'Khin', 'Win', 'Aye', 'Aung', 'Thein',
            'Lwin', 'Kyaw', 'Swe', 'Myo', 'Naing', 'Than',
            'Hlaing', 'Tun', 'Wai', 'Zaw', 'Myint', 'Phyo',
            'Htike', 'Yee', 'Nway', 'Oo', 'Shwe', 'Yan',
            'Zin', 'Thet', 'Bo', 'San', 'Min', 'Htet',
            'Mya', 'Nwe', 'Ko', 'Sein', 'Soe', 'Paing',
            'Thiha', 'Thu', 'Wun', 'Ye', 'Za', 'Ba',
            'Daw', 'Ei', 'Fong', 'Hmwe', 'Kyi', 'Lin',
            'Myat', 'Nanda',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'myanmar.com.mm', 'mptmail.net.mm', 'live.com', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: ng — Nigerian
     * COVERS: Nigeria
     * NOTE: Covers Yoruba, Igbo, Hausa, and Edo naming
     *       traditions — Nigeria's four largest groups.
     * ══════════════════════════════════════════════════════ */
    ng: {
        maleFirst: [
            'Emeka', 'Chukwuemeka', 'Babatunde', 'Abiodun', 'Segun',
            'Kunle', 'Tunde', 'Biodun', 'Chidi', 'Uche',
            'Eze', 'Nnamdi', 'Aminu', 'Musa', 'Yusuf',
            'Ibrahim', 'Adamu', 'Sani', 'Bala', 'Garba',
            'Oluwaseun', 'Oluwasegun', 'Adebayo', 'Adeola', 'Adewale',
            'Olawale', 'Olumide', 'Ayodele', 'Taiwo', 'Kehinde',
            'Chinedu', 'Chibuike', 'Ugochukwu', 'Obinna', 'Ikenna',
            'Obi', 'Ejike', 'Ifeanyi', 'Kelechi', 'Somto',
            'Olamide', 'Seun', 'Tobi', 'Dapo', 'Femi',
            'Gbenga', 'Hakeem', 'Jide', 'Lanre', 'Nonso',
        ],
        femaleFirst: [
            'Ngozi', 'Amaka', 'Chisom', 'Adaeze', 'Blessing',
            'Chiamaka', 'Ifeoma', 'Nneka', 'Ogochi', 'Chinyere',
            'Funke', 'Bimpe', 'Yetunde', 'Adunola', 'Simisola',
            'Titilayo', 'Yewande', 'Abike', 'Bosede', 'Damilola',
            'Kemi', 'Lola', 'Modupe', 'Nike', 'Olayinka',
            'Peju', 'Remi', 'Sade', 'Toyin', 'Uche',
            'Hafsat', 'Khadija', 'Maryam', 'Zainab', 'Fatima',
            'Aisha', 'Hauwa', 'Ramatu', 'Saratu', 'Tani',
            'Adaora', 'Ebele', 'Ginika', 'Obiageli', 'Uzoamaka',
            'Amidat', 'Bidemi', 'Chidinma', 'Dolapo', 'Ejiro',
        ],
        lastNames: [
            'Okonkwo', 'Adeyemi', 'Bello', 'Chukwu', 'Dike',
            'Eze', 'Fashola', 'Gbadebo', 'Haruna', 'Igwe',
            'Jibril', 'Kalu', 'Lawal', 'Musa', 'Nwosu',
            'Obi', 'Okafor', 'Okeke', 'Ola', 'Olawale',
            'Omotosho', 'Onyekachi', 'Osei', 'Oyedepo', 'Ozoemena',
            'Sule', 'Tunde', 'Umar', 'Uzo', 'Yakubu',
            'Abubakar', 'Badmus', 'Chioma', 'Danjuma', 'Emeka',
            'Fagbohun', 'Gyang', 'Hassan', 'Ilori', 'Johnson',
            'Kayode', 'Leke', 'Makinde', 'Nzike', 'Ogunleye',
            'Rufai', 'Salami', 'Taiwo', 'Udokwu', 'Wale',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'live.com', 'yahoo.co.uk', 'icloud.com', 'protonmail.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: ke — Kenyan / Swahili
     * COVERS: Kenya, Tanzania.
     * ══════════════════════════════════════════════════════ */
    ke: {
        maleFirst: [
            'Brian', 'Kevin', 'David', 'John', 'James', 'Peter',
            'Samuel', 'Joseph', 'Michael', 'Paul', 'George', 'Daniel',
            'Emmanuel', 'Francis', 'Geoffrey', 'Harrison', 'Isaac',
            'Jacob', 'Kenneth', 'Lawrence', 'Martin', 'Nicholas',
            'Oliver', 'Patrick', 'Richard', 'Simon', 'Thomas',
            'Victor', 'William', 'Zachary', 'Allan', 'Benedict',
            'Charles', 'Dennis', 'Edward', 'Felix', 'Gilbert',
            'Henry', 'Ian', 'Joel', 'Kamau', 'Leting',
            'Muema', 'Njoroge', 'Ochieng', 'Odhiambo', 'Otieno',
            'Wangui', 'Wanyoike', 'Kibe',
        ],
        femaleFirst: [
            'Grace', 'Faith', 'Hope', 'Mercy', 'Charity', 'Joy',
            'Esther', 'Ruth', 'Lydia', 'Miriam', 'Priscilla',
            'Tabitha', 'Salome', 'Jemimah', 'Abigail', 'Beatrice',
            'Caroline', 'Diana', 'Elizabeth', 'Florence', 'Gloria',
            'Hannah', 'Irene', 'Jacqueline', 'Karen', 'Linda',
            'Mary', 'Nancy', 'Olive', 'Pauline', 'Rebecca',
            'Susan', 'Teresia', 'Veronica', 'Wanjiru', 'Wairimu',
            'Angela', 'Brenda', 'Catherine', 'Dorothy', 'Eunice',
            'Fatuma', 'Gladys', 'Harriet', 'Ivy', 'Janet',
            'Leah', 'Peninah', 'Sharon',
        ],
        lastNames: [
            'Kamau', 'Wanjiku', 'Otieno', 'Waweru', 'Kimani',
            'Mwangi', 'Njoroge', 'Ochieng', 'Njenga', 'Odhiambo',
            'Owino', 'Kipchoge', 'Kiptoo', 'Kiprotich', 'Kogo',
            'Langat', 'Cheruiyot', 'Rotich', 'Kosgei', 'Juma',
            'Achieng', 'Akello', 'Anyango', 'Adhiambo', 'Atieno',
            'Auma', 'Awino', 'Kendi', 'Muthoni', 'Nyambura',
            'Wangari', 'Njeri', 'Karimi', 'Ndung\'u', 'Gathu',
            'Githae', 'Kabiru', 'Kariuki', 'Kuria', 'Macharia',
            'Muriithi', 'Mutahi', 'Muturi', 'Ndegwa', 'Nyaga',
            'Nyambura', 'Nzoka', 'Ombati', 'Onchoke', 'Osoro',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'ke.com', 'safaricom.co.ke', 'live.com', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: za — South African
     * COVERS: South Africa
     * NOTE: Reflects South Africa's diverse naming landscape
     *       including Zulu, Xhosa, Sotho, Afrikaans, and
     *       English naming traditions.
     * ══════════════════════════════════════════════════════ */
    za: {
        maleFirst: [
            'Thabo', 'Sipho', 'Bongani', 'Sifiso', 'Mthokozisi',
            'Nhlanhla', 'Sandile', 'Lungelo', 'Mpho', 'Teboho',
            'Lerato', 'Kagiso', 'Tumelo', 'Refilwe', 'Tshepo',
            'Jan', 'Pieter', 'Christiaan', 'Hendrik', 'Francois',
            'Andries', 'Gerrit', 'Kobus', 'Nico', 'Willem',
            'Brendan', 'Craig', 'Dylan', 'Grant', 'Jason',
            'Kyle', 'Luke', 'Nathan', 'Ryan', 'Shane',
            'Xolani', 'Zakhele', 'Sibusiso', 'Mlungisi', 'Siyabonga',
            'Buyani', 'Cebolenkosi', 'Dumisani', 'Fani', 'Gatsha',
            'Jabulani', 'Kwanele', 'Luthando', 'Mduduzi', 'Nhlanhlayethu',
        ],
        femaleFirst: [
            'Nomvula', 'Zanele', 'Thandi', 'Bongiwe', 'Lungile',
            'Nompumelelo', 'Sibongile', 'Nozipho', 'Nokukhanya',
            'Lindiwe', 'Ntombi', 'Nonhlanhla', 'Nokuthula', 'Nomsa',
            'Marie', 'Anri', 'Lize', 'Rene', 'Ansie',
            'Elsa', 'Hester', 'Ina', 'Katryn', 'Lena',
            'Amy', 'Caitlin', 'Jessica', 'Kelly', 'Lauren',
            'Melissa', 'Nicole', 'Rachel', 'Sarah', 'Tanya',
            'Asanda', 'Busisiwe', 'Celiwe', 'Duduzile', 'Gugulethu',
            'Hlengiwe', 'Iphiwe', 'Jabulile', 'Khanyisile', 'Lwandile',
            'Mpume', 'Nobuhle', 'Phumzile', 'Sindisiwe', 'Thandeka',
        ],
        lastNames: [
            'Dlamini', 'Nkosi', 'Mthembu', 'Shabalala', 'Ntuli',
            'Ndlovu', 'Khumalo', 'Mahlangu', 'Zulu', 'Mkhize',
            'Ngcobo', 'Ntombela', 'Buthelezi', 'Sibiya', 'Myeni',
            'Van der Merwe', 'Botha', 'Pretorius', 'Nel', 'De Villiers',
            'Venter', 'Joubert', 'Prinsloo', 'Swanepoel', 'Van Niekerk',
            'Smith', 'Jones', 'Williams', 'Brown', 'Taylor',
            'Mokoena', 'Motsepe', 'Nkuna', 'Mabunda', 'Chauke',
            'Mamabolo', 'Nkadimeng', 'Sefoka', 'Setati', 'Thabethe',
            'Dhlamini', 'Mhlongo', 'Msomi', 'Mthethwa', 'Zondi',
            'Baloyi', 'Chabalala', 'Maluleke', 'Mkhabela', 'Mathebula',
        ],
        emailDomains: [
            'gmail.com', 'vodamail.co.za', 'webmail.co.za', 'hotmail.com',
            'outlook.com', 'mweb.co.za', 'telkomsa.net', 'icloud.com',
        ],
    },

    /* ══════════════════════════════════════════════════════
     * POOL: et — Ethiopian
     * COVERS: Ethiopia, Eritrea.
     * ══════════════════════════════════════════════════════ */
    et: {
        maleFirst: [
            'Abebe', 'Dawit', 'Haile', 'Tewodros', 'Yonas',
            'Girma', 'Tesfaye', 'Mulugeta', 'Seyoum', 'Bekele',
            'Alem', 'Biniyam', 'Chala', 'Dejene', 'Endalkachew',
            'Fekadu', 'Getachew', 'Henok', 'Isayas', 'Jobir',
            'Kiros', 'Lemma', 'Meaza', 'Negasi', 'Orkid',
            'Paulos', 'Rahel', 'Semret', 'Tafesse', 'Uchenna',
            'Wubshet', 'Yirga', 'Zelalem', 'Amanuel', 'Bereket',
            'Eyouel', 'Fitsum', 'Goitom', 'Hailemariam', 'Iyasu',
            'Kibrom', 'Luel', 'Mengist', 'Nebiyou', 'Okbe',
            'Petros', 'Redae', 'Solomon', 'Tsegay', 'Weldezghi',
        ],
        femaleFirst: [
            'Tigist', 'Hiwot', 'Meron', 'Selam', 'Firehiwot',
            'Alemitu', 'Bethlehem', 'Chaltu', 'Dinkinesh', 'Eden',
            'Frehiwet', 'Gelane', 'Hilina', 'Itiyopia', 'Jember',
            'Kalkidan', 'Leteyesus', 'Miriam', 'Nigist', 'Omer',
            'Pintuwit', 'Rahel', 'Semhar', 'Tirhas', 'Urawit',
            'Weini', 'Yeshi', 'Zenash', 'Almaz', 'Bezawit',
            'Etetu', 'Fenanesh', 'Genet', 'Hayat', 'Imiye',
            'Kefya', 'Liyunet', 'Mihret', 'Nigest', 'Orit',
            'Ribka', 'Saba', 'Tariku', 'Urtecha', 'Wubet',
            'Yordanos', 'Zinash', 'Aklile', 'Birhan', 'Elsabeti',
        ],
        lastNames: [
            'Haile', 'Tesfaye', 'Bekele', 'Girma', 'Abebe',
            'Tadesse', 'Mulugeta', 'Negash', 'Mekonen', 'Wolde',
            'Alemu', 'Biru', 'Demeke', 'Eshete', 'Gizaw',
            'Hailemariam', 'Kebede', 'Lemma', 'Mekonnen', 'Nigusse',
            'Olana', 'Paulos', 'Retta', 'Shiferaw', 'Tamiru',
            'Tura', 'Wakjira', 'Yalew', 'Zerihun', 'Assefa',
            'Bezabih', 'Feleke', 'Gebremedhin', 'Hagos', 'Idris',
            'Jilo', 'Kemal', 'Mengistu', 'Negera', 'Ojule',
            'Petros', 'Regassa', 'Seifu', 'Tsegaye', 'Umer',
            'Wari', 'Yimam', 'Zeleke', 'Anbesa', 'Desta',
        ],
        emailDomains: [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            'ethionet.et', 'etb.et', 'live.com', 'icloud.com',
        ],
    },

}); /* ── end window.nameDatabase ── */
