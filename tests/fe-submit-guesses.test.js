const test = require('node:test');
const assert = require('node:assert');

// Helper to create mock DOM elements
function createMockElement(id, tagName = 'div') {
    const listeners = {};
    const classSet = new Set();
    const attributes = {};
    return {
        id,
        tagName,
        value: '',
        innerText: '',
        textContent: '',
        disabled: false,
        src: '',
        style: {},
        classList: {
            add: (cls) => classSet.add(cls),
            remove: (cls) => classSet.delete(cls),
            contains: (cls) => classSet.has(cls)
        },
        setAttribute: function (name, val) {
            attributes[name] = String(val);
        },
        getAttribute: function (name) {
            return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
        },
        removeAttribute: function (name) {
            delete attributes[name];
        },
        focus: function () {
            this.focused = true;
        },
        addEventListener: function (event, handler) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
        },
        dispatchEvent: function (event, eventObj = {}) {
            if (listeners[event]) {
                listeners[event].forEach(fn => fn(eventObj));
            }
        },
        play: async function () {
            return Promise.resolve();
        }
    };
}

function setupMockDom() {
    const elements = {
        playerNameInput: createMockElement('playerNameInput', 'input'),
        setPlayerNameBtn: createMockElement('setPlayerNameBtn', 'button'),
        playSongBtn: createMockElement('playSongBtn', 'button'),
        songGuessInput: createMockElement('songGuessInput', 'input'),
        artistGuessInput: createMockElement('artistGuessInput', 'input'),
        submitGuessBtn: createMockElement('submitGuessBtn', 'button'),
        submitAllGuessesBtn: createMockElement('submitAllGuessesBtn', 'button'),
        result: createMockElement('result', 'div'),
        correctAnswers: createMockElement('correctAnswers', 'div'),
        audioPlayer: createMockElement('audioPlayer', 'audio')
    };

    global.document = {
        body: { style: {} },
        getElementById: (id) => elements[id] || null
    };

    return elements;
}

test('Submit Guesses State and Error Handling', async (t) => {
    await t.test('prevents gameplay and submission until player name is configured', () => {
        const dom = setupMockDom();
        // Clear cached module if any
        delete require.cache[require.resolve('../dockerfiles/fe/script.js.template')];
        const script = require('../dockerfiles/fe/script.js.template');

        script.initializeGame();

        // playSongBtn and submitAllGuessesBtn must be disabled initially
        assert.strictEqual(dom.playSongBtn.disabled, true, 'playSongBtn should be disabled initially');
        assert.strictEqual(dom.submitAllGuessesBtn.disabled, true, 'submitAllGuessesBtn should be disabled initially');
        assert.strictEqual(script.playerName, '', 'playerName should be empty initially');

        // Setting empty name should fail, highlight input, and keep playSongBtn disabled
        dom.playerNameInput.value = '   ';
        script.setPlayerName();
        assert.strictEqual(dom.playSongBtn.disabled, true, 'playSongBtn should remain disabled with empty name');
        assert.strictEqual(dom.playerNameInput.classList.contains('input-error'), true, 'playerNameInput should have input-error class');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-invalid'), 'true', 'aria-invalid should be set on error');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-describedby'), 'result', 'aria-describedby should link to error message');
        assert.match(dom.result.innerText, /valid player name/i, 'should inform user to enter a valid name');

        // Entering valid name enables playSongBtn
        dom.playerNameInput.value = 'TestPlayer';
        script.setPlayerName();
        assert.strictEqual(script.playerName, 'TestPlayer', 'playerName should be set');
        assert.strictEqual(dom.playSongBtn.disabled, false, 'playSongBtn should be enabled once name is set');
        assert.strictEqual(dom.submitAllGuessesBtn.disabled, true, 'submitAllGuessesBtn should still be disabled with 0 guesses');
        assert.strictEqual(dom.playerNameInput.classList.contains('input-error'), false, 'input-error should be removed');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-invalid'), null, 'aria-invalid should be removed on valid name');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-describedby'), null, 'aria-describedby should be removed on valid name');
    });

    await t.test('prevents submission when no guesses have been recorded', () => {
        const dom = setupMockDom();
        delete require.cache[require.resolve('../dockerfiles/fe/script.js.template')];
        const script = require('../dockerfiles/fe/script.js.template');

        script.initializeGame();
        dom.playerNameInput.value = 'TestPlayer';
        script.setPlayerName();

        assert.strictEqual(script.guesses.length, 0, 'guesses array should be empty');
        assert.strictEqual(dom.submitAllGuessesBtn.disabled, true, 'submitAllGuessesBtn must remain disabled');

        // If submitAllGuesses is invoked with empty guesses, it should guard and inform user
        script.submitAllGuesses();
        assert.match(dom.result.innerText, /at least one song and artist guess/i, 'should prompt user to enter at least one guess');
    });

    await t.test('enables submitAllGuessesBtn once at least one guess has been recorded', () => {
        const dom = setupMockDom();
        delete require.cache[require.resolve('../dockerfiles/fe/script.js.template')];
        const script = require('../dockerfiles/fe/script.js.template');

        script.initializeGame();
        dom.playerNameInput.value = 'TestPlayer';
        script.setPlayerName();

        // Start playing a song
        script.playNextSong();
        assert.strictEqual(script.currentSongIndex, 1, 'currentSongIndex should be 1');

        // Submit a valid guess
        dom.songGuessInput.value = 'Beautiful Day';
        dom.artistGuessInput.value = 'U2';
        script.submitGuess();

        assert.strictEqual(script.guesses.length, 1, 'guesses should have 1 item');
        assert.strictEqual(dom.submitAllGuessesBtn.disabled, false, 'submitAllGuessesBtn should be enabled after 1st guess');
    });

    await t.test('displays actionable error details and logs to console when backend returns 400', async () => {
        const dom = setupMockDom();
        delete require.cache[require.resolve('../dockerfiles/fe/script.js.template')];
        const script = require('../dockerfiles/fe/script.js.template');

        script.initializeGame();
        dom.playerNameInput.value = 'TestPlayer';
        script.setPlayerName();

        script.guesses = [
            { songFile: 'song1', songGuess: 'Beautiful Day', artistGuess: 'U2' }
        ];
        script.updateSubmitAllGuessesBtnState();
        assert.strictEqual(dom.submitAllGuessesBtn.disabled, false);

        // Spy on console.error
        const errorLogs = [];
        const originalConsoleError = console.error;
        console.error = (...args) => {
            errorLogs.push(args);
        };

        try {
            // Case 1: Backend returns 400 with Invalid input when playerName was somehow cleared
            script.playerName = '';
            global.fetch = async () => ({
                ok: false,
                status: 400,
                json: async () => ({ error: 'Invalid input' })
            });

            await script.submitAllGuesses();
            assert.match(dom.result.innerText, /set your player name/i, 'should inform user to set player name');
            assert.strictEqual(dom.playerNameInput.classList.contains('input-error'), true, 'should highlight name input');
            assert.strictEqual(dom.submitAllGuessesBtn.disabled, true);

            // Case 2: Backend returns 400 when guesses are empty
            script.playerName = 'TestPlayer';
            script.guesses = [];
            await script.submitAllGuesses();
            assert.match(dom.result.innerText, /at least one song and artist guess/i, 'should inform user to enter guesses');

            // Case 3: Backend returns 400 with Invalid input from server
            script.playerName = 'TestPlayer';
            script.guesses = [{ songFile: 'song1', songGuess: 'Song', artistGuess: 'Artist' }];
            global.fetch = async () => ({
                ok: false,
                status: 400,
                json: async () => ({ error: 'Invalid input' })
            });
            await script.submitAllGuesses();
            assert.match(dom.result.innerText, /Invalid input/i, 'should display server error');
            assert.match(dom.result.innerText, /player name/i, 'should give actionable next step');

            // Verify console.error logged backend response
            assert.ok(errorLogs.length > 0, 'console.error should have logged backend response');
            const loggedBackend = errorLogs.some(args =>
                args.some(arg => typeof arg === 'object' && arg && arg.error === 'Invalid input')
            );
            assert.ok(loggedBackend, 'console.error should include backend response object');
        } finally {
            console.error = originalConsoleError;
        }
    });

    await t.test('renders game score upon successful submission', async () => {
        const dom = setupMockDom();
        delete require.cache[require.resolve('../dockerfiles/fe/script.js.template')];
        const script = require('../dockerfiles/fe/script.js.template');

        script.initializeGame();
        dom.playerNameInput.value = 'Winner';
        script.setPlayerName();
        script.guesses = [
            { songFile: 'song1', songGuess: 'Beautiful Day', artistGuess: 'U2' }
        ];

        global.fetch = async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                message: 'Game Over! You got 2 out of 2 correct.',
                correctGuesses: 2,
                correctSongGuesses: 1,
                correctArtistGuesses: 1,
                correctAnswers: ['Song: Beautiful Day, Artist: U2']
            })
        });

        await script.submitAllGuesses();

        assert.match(dom.result.innerText, /Game Over!/i, 'resultElement should announce Game Over');
        assert.match(dom.result.innerText, /1 song\(s\) and 1 artist\(s\) correct/i, 'resultElement should display score breakdown');
        assert.match(dom.result.innerText, /Song: Beautiful Day, Artist: U2/i, 'resultElement should display correct answers');
        assert.match(dom.correctAnswers.innerText, /Song: Beautiful Day, Artist: U2/i, 'correctAnswers element should be populated');
        assert.strictEqual(dom.submitAllGuessesBtn.disabled, true, 'submitAllGuessesBtn should remain disabled after completion');
    });

    await t.test('visually highlights playerNameInput when attempting to play without name', () => {
        const dom = setupMockDom();
        delete require.cache[require.resolve('../dockerfiles/fe/script.js.template')];
        const script = require('../dockerfiles/fe/script.js.template');

        script.initializeGame();
        assert.strictEqual(script.playerName, '');

        // Directly call playNextSong without setting name
        script.playNextSong();
        assert.strictEqual(dom.playerNameInput.classList.contains('input-error'), true, 'playerNameInput should be highlighted');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-invalid'), 'true', 'aria-invalid should be set on error');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-describedby'), 'result', 'aria-describedby should link to error message');
        assert.strictEqual(dom.playSongBtn.disabled, true);
        assert.match(dom.result.innerText, /set your player name/i);

        // Typing in playerNameInput clears highlight
        dom.playerNameInput.value = 'A';
        dom.playerNameInput.dispatchEvent('input');
        assert.strictEqual(dom.playerNameInput.classList.contains('input-error'), false, 'typing should clear highlight');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-invalid'), null, 'aria-invalid should be removed on input');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-describedby'), null, 'aria-describedby should be removed on input');
    });

    await t.test('manages ARIA attribute lifecycle on playerNameInput validation error and resolution', () => {
        const dom = setupMockDom();
        delete require.cache[require.resolve('../dockerfiles/fe/script.js.template')];
        const script = require('../dockerfiles/fe/script.js.template');

        script.initializeGame();

        // Trigger validation failure
        script.playNextSong();
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-invalid'), 'true', 'aria-invalid should be set on error');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-describedby'), 'result', 'aria-describedby should link to error message');

        // Clear error state on input
        dom.playerNameInput.value = 'TestPlayer';
        dom.playerNameInput.dispatchEvent('input');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-invalid'), null, 'aria-invalid should be removed when cleared');
        assert.strictEqual(dom.playerNameInput.getAttribute('aria-describedby'), null, 'aria-describedby should be removed when cleared');
    });

    await t.test('supports Enter key in playerNameInput to set name', () => {
        const dom = setupMockDom();
        delete require.cache[require.resolve('../dockerfiles/fe/script.js.template')];
        const script = require('../dockerfiles/fe/script.js.template');

        script.initializeGame();
        dom.playerNameInput.value = 'Bob';
        dom.playerNameInput.dispatchEvent('keydown', { key: 'Enter' });

        assert.strictEqual(script.playerName, 'Bob');
        assert.strictEqual(dom.playSongBtn.disabled, false);
        assert.match(dom.result.innerText, /Welcome, Bob!/i);
    });

    await t.test('handles network failure and server 500 gracefully', async () => {
        const dom = setupMockDom();
        delete require.cache[require.resolve('../dockerfiles/fe/script.js.template')];
        const script = require('../dockerfiles/fe/script.js.template');

        script.initializeGame();
        dom.playerNameInput.value = 'Tester';
        script.setPlayerName();
        script.guesses = [{ songFile: 'song1', songGuess: 'X', artistGuess: 'Y' }];
        script.updateSubmitAllGuessesBtnState();

        // 1. Network failure
        global.fetch = async () => {
            throw new Error('Connection refused');
        };
        await script.submitAllGuesses();
        assert.match(dom.result.innerText, /Network error/i);
        assert.strictEqual(dom.submitAllGuessesBtn.innerText, 'Submit All Guesses');
        assert.strictEqual(dom.submitAllGuessesBtn.disabled, false);

        // 2. 500 Server error
        global.fetch = async () => ({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Internal Server Error' })
        });
        await script.submitAllGuesses();
        assert.match(dom.result.innerText, /Internal Server Error|Server error/i);
        assert.strictEqual(dom.submitAllGuessesBtn.innerText, 'Submit All Guesses');
        assert.strictEqual(dom.submitAllGuessesBtn.disabled, false);
    });
});

