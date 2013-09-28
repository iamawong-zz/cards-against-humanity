Cards Against Humanity
======================

Multiplayer, real time implementation of the popular card game [Cards Against Humanity][1].

### Dependencies:

- Node.js
- MongoDB

### After you clone:

      git submodule update --init --recursive
      npm install

- Copy `config.TEMPLATE.js` to `config.js`.
- Copy `populateDB.TEMPLATE.js` to `populateDB.js`.
- In `config.js`, fill in your mongo connection info.
- In `populateDB.js`, fill in your mongo connection info (line 9).

       node populateDB.js

### Run on dev:
       
       npm run-script dev
       Visit http://localhost:3000/

### Run on prod:

       npm run-script prod
       Visit http://localhost:8080/

[1]: http://cardsagainsthumanity.com/
