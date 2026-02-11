# Writing text into a file

file = open("output.txt", "w")  # "w" mode creates file or overwrites if exists
for i in range(45000):
    file.write("Hello, this is my first text file.\n")
file.close()

print("Text written successfully!")
