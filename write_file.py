with open("output.txt", "w") as file:
    for i in range(10000):
        file.write("Hello, world!\n")
print("Written")