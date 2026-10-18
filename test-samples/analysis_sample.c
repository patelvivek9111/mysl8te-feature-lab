#include <stdio.h>
#include <string.h>

int add(int a, int b) {
    return a + b;
}

int multiply(int a, int b) {
    return a * b;
}

void secret_function() {
    char buffer[100];
    strcpy(buffer, "This is a secret message");
    printf("%s\n", buffer);
}

int main(int argc, char *argv[]) {
    printf("MySL8TE Feature Lab - Binary Analysis Test\n");
    
    int x = 10, y = 20;
    printf("Add: %d + %d = %d\n", x, y, add(x, y));
    printf("Multiply: %d * %d = %d\n", x, y, multiply(x, y));
    
    if (argc > 1 && strcmp(argv[1], "secret") == 0) {
        secret_function();
    }
    
    return 0;
}
