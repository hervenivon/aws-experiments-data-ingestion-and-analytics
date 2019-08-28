import time
import os

# https://stackoverflow.com/questions/4906977/how-to-access-environment-variable-values
print(os.environ)

while True:
    time.sleep(2)
    print('.', end = '', flush = True)
