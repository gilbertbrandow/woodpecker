NVM = [ -f "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" ] && . "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm install --no-progress || true

setup:
	$(NVM) && npm install

lint:
	$(NVM) && npm run typecheck

test:
	$(NVM) && npm run test:run

.PHONY: setup lint test
