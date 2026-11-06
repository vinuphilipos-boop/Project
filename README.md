# Eisenhower Box

A simple, dependency-free web app for prioritizing tasks with the Eisenhower Matrix.

|               | Urgent       | Not urgent   |
|---------------|--------------|--------------|
| **Important**     | **Do**       | **Schedule** |
| **Not important** | **Delegate** | **Delete**   |

## Features

- Add tasks and tick **Urgent** / **Important** to place them in the right box
- Drag and drop tasks between boxes
- Mark tasks complete, double-click to edit, × to delete
- "Clear completed" removes finished tasks
- Tasks are saved in your browser (localStorage)
- Responsive layout for mobile

## Run it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

then visit http://localhost:8000.
