set reviewURL to "http://127.0.0.1:43127/"
set serverScript to POSIX path of (path to resource "review_server.py")
set launchCommand to "/usr/bin/nohup /usr/bin/python3 " & quoted form of serverScript & " > /tmp/project-controls-dashboard-review.log 2>&1 &"

do shell script launchCommand
delay 1
open location reviewURL
